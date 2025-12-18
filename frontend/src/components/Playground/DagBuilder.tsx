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
} from "reactflow";
import "reactflow/dist/style.css";
import { TaskNode } from "./TaskNode";

const nodeTypes: NodeTypes = {
  task: TaskNode,
};

const initialNodes = [
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
    data: { label: "T2", payload: "work", status: "pending", priority: 1 },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "T1", target: "T2", animated: true },
];

export function DagBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="w-full h-full min-h-[600px] border rounded-lg bg-background overflow-hidden">
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
        <MiniMap 
          nodeColor={(node) => {
            return "currentColor";
          }}
          maskColor="rgba(0,0,0,0.5)"
          className="bg-background border border-border"
        />
      </ReactFlow>
    </div>
  );
}
