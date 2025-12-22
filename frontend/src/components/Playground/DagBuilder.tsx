"use client";

import { useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  NodeTypes,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { TaskNode } from "./TaskNode";
import { DAG_TEMPLATES } from "@/lib/templates";
import { flowToTasks } from "@/lib/dagConvert";
import { submitDag } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { TaskEvent } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

const nodeTypes: NodeTypes = {
  task: TaskNode,
};

const initialNodes: any[] = [
  {
    id: "T1",
    type: "task",
    position: { x: 250, y: 100 },
    data: { label: "T1", payload: "sleep", status: "pending", priority: 1, duration: 2000 },
  },
  {
    id: "T2",
    type: "task",
    position: { x: 250, y: 250 },
    data: { label: "T2", payload: "work", status: "pending", priority: 1, duration: undefined },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "T1", target: "T2", animated: true },
];

export function DagBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const { status: wsStatus } = useWebSocket({
    onMessage: (event: TaskEvent) => {
      // Map backend events to our UI node state
      if (['task.started', 'task.completed', 'task.failed', 'task.retry'].includes(event.type)) {
        setNodes((nds) => 
          nds.map((n) => {
            if (n.id === event.task_id) {
              const statusMap: any = {
                'task.started': 'running',
                'task.completed': 'completed',
                'task.failed': 'failed',
                'task.retry': 'retrying'
              };
              return { ...n, data: { ...n.data, status: statusMap[event.type] } };
            }
            return n;
          })
        );
      } else if (event.type === "system.crash") {
        toast.error("System crashed!");
      } else if (event.type === "system.recover") {
        toast.success("System recovered, resuming DAG...");
      }
    }
  });

  const loadTemplate = (templateId: string | null) => {
    if (!templateId) return;
    const template = DAG_TEMPLATES[templateId];
    if (template) {
      setNodes(template.nodes as any);
      setEdges(template.edges as any);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      // Reset all node statuses to pending before submission
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, status: "pending" } }))
      );
      const tasks = flowToTasks(nodes, edges);
      await submitDag(tasks);
      toast.success("DAG submitted successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit DAG");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full min-h-[600px] border-r bg-background overflow-hidden relative">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 text-xs font-mono bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full border shadow-sm">
        <div className={cn("w-2 h-2 rounded-full", wsStatus === 'connected' ? "bg-emerald-500 animate-pulse" : "bg-destructive")} />
        {wsStatus === 'connected' ? 'Live Execution' : 'Disconnected'}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-muted/10"
      >
        <Background gap={20} size={1} color="currentColor" className="opacity-10" />
        <Controls className="bg-background border shadow-sm" />
        <Panel position="top-left" className="bg-background/80 backdrop-blur-md p-2 rounded-lg border shadow-sm flex items-center gap-2">
          <Select onValueChange={loadTemplate}>
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue placeholder="Load Template..." />
            </SelectTrigger>
            <SelectContent>
              {Object.values(DAG_TEMPLATES).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSubmit} disabled={isSubmitting} size="sm" className="gap-2">
            <Play className="w-4 h-4" />
            {isSubmitting ? "Submitting..." : "Submit DAG"}
          </Button>
        </Panel>
        <MiniMap 
          nodeColor={() => "currentColor"}
          maskColor="rgba(0,0,0,0.5)"
          className="bg-background border border-border"
        />
      </ReactFlow>
    </div>
  );
}
