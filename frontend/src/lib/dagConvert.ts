import { Node, Edge } from "reactflow";
import { Task } from "@/types";

/**
 * Converts React Flow nodes and edges into the Task array format
 * expected by the backend DAG ingestion endpoint.
 */
export function flowToTasks(nodes: Node[], edges: Edge[]): Task[] {
  // Build adjacency list for dependencies (target -> [sources])
  const dependenciesMap: Record<string, string[]> = {};
  
  // Initialize map for all nodes
  nodes.forEach(node => {
    dependenciesMap[node.id] = [];
  });

  // Populate from edges. Edge: source -> target means target depends on source
  edges.forEach(edge => {
    if (dependenciesMap[edge.target]) {
      dependenciesMap[edge.target].push(edge.source);
    } else {
      dependenciesMap[edge.target] = [edge.source];
    }
  });

  return nodes.map(node => {
    const data = node.data as any; // Usually TaskNodeData
    const task: Task = {
      id: node.id,
      payload: data.payload || "work",
      priority: data.priority || 1,
      dependencies: dependenciesMap[node.id] || [],
    };
    
    // Pass duration if simulating sleep to help visual demo
    if (task.payload === "sleep" && data.duration) {
       // Since the backend uses environment variable DEMO_MODE for sleep, 
       // or we could possibly pass duration via metadata. 
       // For now, our backend model `TaskEvent` has Duration, but submission Task has `payload` and `priority`.
       // We can just rely on the backend's inherent sleep or extend the payload definition if needed.
       // The backend implementation currently does generic work or panic based on payload name.
    }

    return task;
  });
}
