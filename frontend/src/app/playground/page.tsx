"use client";

import { ReactFlowProvider } from "reactflow";
import { DagBuilder } from "@/components/Playground/DagBuilder";
import { NodeConfigPanel } from "@/components/Playground/NodeConfigPanel";
import { EventLog } from "@/components/Playground/EventLog";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";

export default function PlaygroundPage() {
  return (
    <div className="container mx-auto px-4 py-8 flex flex-col gap-4 h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Playground</h1>
        <p className="text-muted-foreground">Build a DAG, submit it, and watch the executor handle crashes in real-time.</p>
      </div>

      <div className="flex-1 bg-card border rounded-lg overflow-hidden shadow-sm min-h-0">
        <ReactFlowProvider>
          {/* @ts-ignore - shadcn resizable panel group types mismatch in v4 */}
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={70}>
              {/* @ts-ignore */}
              <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={75} minSize={50}>
                  <DagBuilder />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={25} minSize={20}>
                  <NodeConfigPanel />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={30} minSize={15}>
              <EventLog />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
