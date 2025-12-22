import { Node, Edge } from "reactflow";

export type DagTemplate = {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
};

export const DAG_TEMPLATES: Record<string, DagTemplate> = {
  simple: {
    id: "simple",
    name: "Simple Pipeline",
    description: "A linear sequence of 3 tasks.",
    nodes: [
      { id: "T1", type: "task", position: { x: 250, y: 50 }, data: { label: "T1", payload: "work", status: "pending", priority: 1, duration: 2000 } },
      { id: "T2", type: "task", position: { x: 250, y: 200 }, data: { label: "T2", payload: "work", status: "pending", priority: 1, duration: 1500 } },
      { id: "T3", type: "task", position: { x: 250, y: 350 }, data: { label: "T3", payload: "work", status: "pending", priority: 1, duration: 1000 } },
    ],
    edges: [
      { id: "e1", source: "T1", target: "T2", animated: true, type: "smoothstep" },
      { id: "e2", source: "T2", target: "T3", animated: true, type: "smoothstep" },
    ]
  },
  diamond: {
    id: "diamond",
    name: "Diamond Fan-out",
    description: "A root task splitting into two parallel paths, rejoining at the end.",
    nodes: [
      { id: "Root", type: "task", position: { x: 250, y: 50 }, data: { label: "Root", payload: "work", status: "pending", priority: 1, duration: 1000 } },
      { id: "BranchA", type: "task", position: { x: 100, y: 200 }, data: { label: "BranchA", payload: "sleep", status: "pending", priority: 2, duration: 3000 } },
      { id: "BranchB", type: "task", position: { x: 400, y: 200 }, data: { label: "BranchB", payload: "work", status: "pending", priority: 2, duration: 1500 } },
      { id: "Merge", type: "task", position: { x: 250, y: 350 }, data: { label: "Merge", payload: "work", status: "pending", priority: 1, duration: 1000 } },
    ],
    edges: [
      { id: "e1", source: "Root", target: "BranchA", animated: true, type: "smoothstep" },
      { id: "e2", source: "Root", target: "BranchB", animated: true, type: "smoothstep" },
      { id: "e3", source: "BranchA", target: "Merge", animated: true, type: "smoothstep" },
      { id: "e4", source: "BranchB", target: "Merge", animated: true, type: "smoothstep" },
    ]
  },
  complex: {
    id: "complex",
    name: "Complex Web (Crash Demo)",
    description: "A larger graph designed to be submitted right before a crash simulation.",
    nodes: [
      { id: "Ingest", type: "task", position: { x: 250, y: 0 }, data: { label: "Ingest", payload: "work", status: "pending", priority: 1, duration: 1000 } },
      { id: "Validate", type: "task", position: { x: 250, y: 120 }, data: { label: "Validate", payload: "work", status: "pending", priority: 1, duration: 1500 } },
      { id: "ProcessA", type: "task", position: { x: 50, y: 250 }, data: { label: "ProcessA", payload: "sleep", status: "pending", priority: 2, duration: 5000 } },
      { id: "ProcessB", type: "task", position: { x: 250, y: 250 }, data: { label: "ProcessB", payload: "sleep", status: "pending", priority: 3, duration: 6000 } },
      { id: "ProcessC", type: "task", position: { x: 450, y: 250 }, data: { label: "ProcessC", payload: "sleep", status: "pending", priority: 4, duration: 4500 } },
      { id: "Aggregate", type: "task", position: { x: 250, y: 380 }, data: { label: "Aggregate", payload: "work", status: "pending", priority: 1, duration: 2000 } },
      { id: "Report", type: "task", position: { x: 250, y: 500 }, data: { label: "Report", payload: "work", status: "pending", priority: 1, duration: 1000 } },
    ],
    edges: [
      { id: "e1", source: "Ingest", target: "Validate", animated: true, type: "smoothstep" },
      { id: "e2", source: "Validate", target: "ProcessA", animated: true, type: "smoothstep" },
      { id: "e3", source: "Validate", target: "ProcessB", animated: true, type: "smoothstep" },
      { id: "e4", source: "Validate", target: "ProcessC", animated: true, type: "smoothstep" },
      { id: "e5", source: "ProcessA", target: "Aggregate", animated: true, type: "smoothstep" },
      { id: "e6", source: "ProcessB", target: "Aggregate", animated: true, type: "smoothstep" },
      { id: "e7", source: "ProcessC", target: "Aggregate", animated: true, type: "smoothstep" },
      { id: "e8", source: "Aggregate", target: "Report", animated: true, type: "smoothstep" },
    ]
  }
};
