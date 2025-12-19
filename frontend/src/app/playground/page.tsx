"use client";

import { ReactFlowProvider } from "reactflow";
import { DagBuilder } from "@/components/Playground/DagBuilder";
import { NodeConfigPanel } from "@/components/Playground/NodeConfigPanel";

export default function PlaygroundPage() {
  return (
    <div className="container mx-auto px-4 py-8 flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Playground</h1>
        <p className="text-muted-foreground">Build a DAG, submit it, and watch the executor handle crashes in real-time.</p>
      </div>

      <div className="flex bg-card border rounded-lg overflow-hidden shadow-sm">
        <ReactFlowProvider>
          <div className="flex-1">
            <DagBuilder />
          </div>
          <NodeConfigPanel />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
