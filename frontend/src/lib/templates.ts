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
    description: "One root, two branches, then a merge task.",
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
    description: "A larger graph for the crash/recovery demo.",
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
  },
  mapReduce: {
    id: "mapReduce",
    name: "MapReduce Shape",
    description: "Split, map, shuffle, reduce, and finalize tasks.",
    nodes: [
      { id: "Split", type: "task", position: { x: 250, y: 50 }, data: { label: "Split Data", payload: "work", status: "pending", priority: 1, duration: 1000 } },
      { id: "MapA", type: "task", position: { x: 100, y: 200 }, data: { label: "Map Chunk A", payload: "sleep", status: "pending", priority: 2, duration: 3000 } },
      { id: "MapB", type: "task", position: { x: 250, y: 200 }, data: { label: "Map Chunk B", payload: "work", status: "pending", priority: 2, duration: 2500 } },
      { id: "MapC", type: "task", position: { x: 400, y: 200 }, data: { label: "Map Chunk C", payload: "sleep", status: "pending", priority: 2, duration: 4000 } },
      { id: "Shuffle", type: "task", position: { x: 250, y: 350 }, data: { label: "Shuffle / Sort", payload: "work", status: "pending", priority: 1, duration: 1500 } },
      { id: "ReduceA", type: "task", position: { x: 150, y: 500 }, data: { label: "Reduce Keys A-M", payload: "work", status: "pending", priority: 1, duration: 2000 } },
      { id: "ReduceB", type: "task", position: { x: 350, y: 500 }, data: { label: "Reduce Keys N-Z", payload: "work", status: "pending", priority: 1, duration: 2200 } },
      { id: "Finalize", type: "task", position: { x: 250, y: 650 }, data: { label: "Finalize", payload: "work", status: "pending", priority: 1, duration: 1000 } }
    ],
    edges: [
      { id: "e1", source: "Split", target: "MapA", animated: true, type: "smoothstep" },
      { id: "e2", source: "Split", target: "MapB", animated: true, type: "smoothstep" },
      { id: "e3", source: "Split", target: "MapC", animated: true, type: "smoothstep" },
      { id: "e4", source: "MapA", target: "Shuffle", animated: true, type: "smoothstep" },
      { id: "e5", source: "MapB", target: "Shuffle", animated: true, type: "smoothstep" },
      { id: "e6", source: "MapC", target: "Shuffle", animated: true, type: "smoothstep" },
      { id: "e7", source: "Shuffle", target: "ReduceA", animated: true, type: "smoothstep" },
      { id: "e8", source: "Shuffle", target: "ReduceB", animated: true, type: "smoothstep" },
      { id: "e9", source: "ReduceA", target: "Finalize", animated: true, type: "smoothstep" },
      { id: "e10", source: "ReduceB", target: "Finalize", animated: true, type: "smoothstep" },
    ]
  },
  bipartite: {
    id: "bipartite",
    name: "Bipartite Graph",
    description: "Multiple source tasks feeding shared sink tasks.",
    nodes: [
      { id: "A1", type: "task", position: { x: 100, y: 100 }, data: { label: "Source A1", payload: "work", status: "pending", priority: 1, duration: 2000 } },
      { id: "A2", type: "task", position: { x: 250, y: 100 }, data: { label: "Source A2", payload: "work", status: "pending", priority: 1, duration: 1500 } },
      { id: "A3", type: "task", position: { x: 400, y: 100 }, data: { label: "Source A3", payload: "work", status: "pending", priority: 1, duration: 2500 } },
      { id: "B1", type: "task", position: { x: 175, y: 300 }, data: { label: "Sink B1", payload: "sleep", status: "pending", priority: 2, duration: 3000 } },
      { id: "B2", type: "task", position: { x: 325, y: 300 }, data: { label: "Sink B2", payload: "sleep", status: "pending", priority: 2, duration: 3000 } },
    ],
    edges: [
      { id: "e1", source: "A1", target: "B1", animated: true, type: "smoothstep" },
      { id: "e2", source: "A1", target: "B2", animated: true, type: "smoothstep" },
      { id: "e3", source: "A2", target: "B1", animated: true, type: "smoothstep" },
      { id: "e4", source: "A2", target: "B2", animated: true, type: "smoothstep" },
      { id: "e5", source: "A3", target: "B1", animated: true, type: "smoothstep" },
      { id: "e6", source: "A3", target: "B2", animated: true, type: "smoothstep" },
    ]
  },
  mesh: {
    id: "mesh",
    name: "Interconnected Mesh",
    description: "An interwoven DAG with several dependency paths.",
    nodes: [
      { id: "N1", type: "task", position: { x: 250, y: 50 }, data: { label: "N1", payload: "work", status: "pending", priority: 1, duration: 1000 } },
      { id: "N2", type: "task", position: { x: 100, y: 150 }, data: { label: "N2", payload: "sleep", status: "pending", priority: 2, duration: 2000 } },
      { id: "N3", type: "task", position: { x: 400, y: 150 }, data: { label: "N3", payload: "work", status: "pending", priority: 1, duration: 1500 } },
      { id: "N4", type: "task", position: { x: 250, y: 250 }, data: { label: "N4", payload: "sleep", status: "pending", priority: 3, duration: 2500 } },
      { id: "N5", type: "task", position: { x: 100, y: 350 }, data: { label: "N5", payload: "work", status: "pending", priority: 1, duration: 1000 } },
      { id: "N6", type: "task", position: { x: 400, y: 350 }, data: { label: "N6", payload: "work", status: "pending", priority: 1, duration: 1200 } },
      { id: "N7", type: "task", position: { x: 250, y: 450 }, data: { label: "N7", payload: "sleep", status: "pending", priority: 4, duration: 3000 } },
    ],
    edges: [
      { id: "e1", source: "N1", target: "N2", animated: true, type: "smoothstep" },
      { id: "e2", source: "N1", target: "N3", animated: true, type: "smoothstep" },
      { id: "e3", source: "N1", target: "N4", animated: true, type: "smoothstep" },
      { id: "e4", source: "N2", target: "N4", animated: true, type: "smoothstep" },
      { id: "e5", source: "N3", target: "N4", animated: true, type: "smoothstep" },
      { id: "e6", source: "N2", target: "N5", animated: true, type: "smoothstep" },
      { id: "e7", source: "N4", target: "N5", animated: true, type: "smoothstep" },
      { id: "e8", source: "N4", target: "N6", animated: true, type: "smoothstep" },
      { id: "e9", source: "N3", target: "N6", animated: true, type: "smoothstep" },
      { id: "e10", source: "N5", target: "N7", animated: true, type: "smoothstep" },
      { id: "e11", source: "N6", target: "N7", animated: true, type: "smoothstep" },
    ]
  }
};
