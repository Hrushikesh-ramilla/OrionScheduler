"use client";

import {
  useCallback, useEffect, useRef, forwardRef, useImperativeHandle,
} from "react";
import ReactFlow, {
  Background, Controls, MiniMap, useNodesState, useEdgesState,
  addEdge, Connection, Edge, NodeTypes, BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { toast } from "sonner";
import { EnhancedTaskNode } from "./EnhancedTaskNode";
import { DAG_TEMPLATES } from "@/lib/templates";
import { flowToTasks } from "@/lib/dagConvert";
import { submitDag, fetchDagState } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { TaskEvent } from "@/types";

const nodeTypes: NodeTypes = { task: EnhancedTaskNode };

// Edge style constants outside component to avoid exhaustive-deps issues
const edgeStyle = { stroke: "hsl(215,15%,30%)", strokeWidth: 1.5 };
const edgeStyleActive = { stroke: "hsl(217,91%,50%)", strokeWidth: 1.5 };
const edgeStyleComplete = { stroke: "hsl(152,69%,35%)", strokeWidth: 1.5 };
const edgeStyleCrash = { stroke: "hsl(215,15%,20%)", strokeWidth: 1 };

const initialNodes: any[] = [
  { id: "T1", type: "task", position: { x: 200, y: 80 }, data: { label: "T1", payload: "sleep", status: "pending", priority: 1 } },
  { id: "T2", type: "task", position: { x: 200, y: 240 }, data: { label: "T2", payload: "work", status: "pending", priority: 1 } },
];
const initialEdges: Edge[] = [
  { id: "e1-2", source: "T1", target: "T2", animated: true, style: { stroke: "hsl(215,15%,35%)", strokeWidth: 1.5 } },
];

export type DagCanvasHandle = {
  loadTemplate: (id: string) => void;
  handleSubmit: () => Promise<boolean>;
};

type DagCanvasProps = {
  onSubmitSuccess?: () => void;
  onWsStatusChange?: (s: "connecting" | "connected" | "disconnected") => void;
};

export const DagCanvas = forwardRef<DagCanvasHandle, DagCanvasProps>(
  ({ onSubmitSuccess, onWsStatusChange }, ref) => {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const cascadeKilledIds = useRef<Set<string>>(new Set());

    const onConnect = useCallback(
      (params: Edge | Connection) => setEdges(eds =>
        addEdge({ ...params, animated: true, style: edgeStyle }, eds)
      ),
      [setEdges]
    );

    const reconstructFromState = useCallback(async () => {
      try {
        const state = await fetchDagState();
        const tasks = state?.tasks;
        if (!tasks || Object.keys(tasks).length === 0) return;
        const statusMap: Record<string, string> = {
          pending: "pending", ready: "pending", running: "running",
          completed: "completed", failed: "failed",
        };
        setNodes(nds => nds.map(n => {
          const task = tasks[n.id];
          if (!task) return n;
          const uiStatus = cascadeKilledIds.current.has(n.id)
            ? "cascade-failed"
            : (statusMap[task.status] ?? "pending");
          return {
            ...n,
            data: {
              ...n.data,
              status: uiStatus,
              retryCount: task.retry_count,
              maxRetries: task.max_retries,
            }
          };
        }));
      } catch (err) {
        console.warn("Failed to reconstruct DAG state:", err);
      }
    }, [setNodes]);

    useEffect(() => { reconstructFromState(); }, [reconstructFromState]);

    const { status: wsStatus } = useWebSocket({
      onMessage: (event: TaskEvent) => {
        if (["task.started", "task.completed", "task.failed", "task.retry"].includes(event.type)) {
          setNodes(nds => nds.map(n => {
            if (n.id !== event.task_id) return n;
            const sm: Record<string, string> = {
              "task.started": "running",
              "task.completed": "completed",
              "task.failed": "failed",
              "task.retry": "retrying",
            };
            return {
              ...n,
              data: {
                ...n.data,
                status: sm[event.type],
                workerId: event.type === "task.started" ? event.worker_id : n.data.workerId,
                retryCount: event.retry ?? n.data.retryCount,
                maxRetries: event.max_retry ?? n.data.maxRetries,
              }
            };
          }));

          if (event.type === "task.started") {
            setEdges(eds => eds.map(e =>
              e.target === event.task_id
                ? { ...e, style: edgeStyleActive }
                : e
            ));
          }
          if (event.type === "task.completed") {
            setEdges(eds => eds.map(e =>
              e.source === event.task_id
                ? { ...e, style: edgeStyleComplete }
                : e
            ));
          }
        }

        if (event.type === "task.cascade" && Array.isArray(event.dag_tasks)) {
          const affected = event.dag_tasks;
          affected.forEach(id => cascadeKilledIds.current.add(id));
          affected.forEach((tid, idx) => {
            setTimeout(() => {
              setNodes(nds => nds.map(n =>
                n.id === tid
                  ? { ...n, data: { ...n.data, status: "cascade-failed" } }
                  : n
              ));
            }, idx * 80);
          });
        }

        if (event.type === "system.crash") {
          setEdges(eds => eds.map(e => ({ ...e, animated: false, style: edgeStyleCrash })));
        }

        if (event.type === "system.recover") {
          reconstructFromState().then(() => {
            setEdges(eds => eds.map(e => ({ ...e, animated: true, style: edgeStyle })));
          });
        }
      }
    });

    useEffect(() => {
      onWsStatusChange?.(wsStatus);
    }, [wsStatus, onWsStatusChange]);

    const loadTemplate = (id: string) => {
      const t = DAG_TEMPLATES[id];
      if (!t) return;
      // Restyle template edges
      const styledEdges = t.edges.map(e => ({
        ...e, animated: true, style: edgeStyle,
      }));
      setNodes(t.nodes as any);
      setEdges(styledEdges as any);
      cascadeKilledIds.current.clear();
    };

    const handleSubmit = async (): Promise<boolean> => {
      let appliedCanvasIds = false;
      const previousNodes = nodes;
      const previousEdges = edges;
      try {
        cascadeKilledIds.current.clear();
        // Suffix all task IDs with a short epoch to ensure uniqueness across runs.
        // The backend WAL persists IDs indefinitely; same template re-submitted = 500.
        const suffix = `_${Date.now()}`;
        const rawTasks = flowToTasks(nodes, edges);
        // Build old-to-new ID map.
        const idMap: Record<string, string> = {};
        rawTasks.forEach(t => { idMap[t.id] = t.id + suffix; });
        // Apply suffix to IDs and dependency references
        const tasks = rawTasks.map(t => ({
          ...t,
          id: idMap[t.id],
          dependencies: t.dependencies.map(dep => idMap[dep] ?? dep),
        }));

        // Update node IDs before submit so early WS events match the canvas.
        setNodes(nds => nds.map(n => ({
          ...n,
          id: idMap[n.id] ?? n.id,
          data: { ...n.data, status: "pending", workerId: undefined, retryCount: 0 },
        })));
        setEdges(eds => eds.map(e => ({
          ...e,
          source: idMap[e.source] ?? e.source,
          target: idMap[e.target] ?? e.target,
          animated: true,
          style: edgeStyle,
        })));
        appliedCanvasIds = true;

        const result = await submitDag(tasks);
        toast.success(`DAG accepted - ${tasks.length} tasks submitted (${result.dag_id})`);
        onSubmitSuccess?.();
        return true;
      } catch (err: any) {
        if (appliedCanvasIds) {
          setNodes(previousNodes);
          setEdges(previousEdges);
        }
        toast.error(err.message || "Failed to submit DAG");
        return false;
      }
    };

    useImperativeHandle(ref, () => ({ loadTemplate, handleSubmit }));

    return (
      <div className="w-full h-full overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="hsl(220,15%,20%)"
          />
          <Controls
            className="!bg-[hsl(220,22%,9%)] !border !border-border !rounded-none"
            showInteractive={false}
          />
          <MiniMap
            nodeColor={(n) => {
              const s = n.data?.status;
              if (s === "running") return "#3b82f6";
              if (s === "completed") return "#10b981";
              if (s === "failed") return "#ef4444";
              if (s === "cascade-failed") return "#f97316";
              if (s === "retrying") return "#f59e0b";
              return "hsl(220,15%,25%)";
            }}
            maskColor="rgba(10,14,23,0.8)"
            style={{
              background: "hsl(220,22%,9%)",
              border: "1px solid hsl(220,15%,18%)",
              borderRadius: "0",
            }}
          />
        </ReactFlow>
      </div>
    );
  }
);

DagCanvas.displayName = "DagCanvas";
