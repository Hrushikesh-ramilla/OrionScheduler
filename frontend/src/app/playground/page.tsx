"use client";

import { useState } from "react";
import { ReactFlowProvider } from "reactflow";
import { DagBuilder } from "@/components/Playground/DagBuilder";
import { NodeConfigPanel } from "@/components/Playground/NodeConfigPanel";
import { EventLog } from "@/components/Playground/EventLog";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { simulateCrash, recoverSystem } from "@/lib/api";
import { AlertOctagon, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export default function PlaygroundPage() {
  const [isCrashed, setIsCrashed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCrash = async () => {
    try {
      setIsProcessing(true);
      await simulateCrash();
      setIsCrashed(true);
      toast.success("Crash signal sent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to simulate crash");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecover = async () => {
    try {
      setIsProcessing(true);
      await recoverSystem();
      setIsCrashed(false);
      toast.success("Recovery signal sent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to recover system");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col gap-4 h-[calc(100vh-4rem)] relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Playground</h1>
          <p className="text-muted-foreground">Build a DAG, submit it, and watch the executor handle crashes in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="destructive" 
            onClick={handleCrash} 
            disabled={isProcessing || isCrashed}
            className="gap-2 font-mono uppercase tracking-widest font-bold"
          >
            <AlertOctagon className="w-4 h-4" />
            Pull the Plug
          </Button>
          <Button 
            variant="outline" 
            onClick={handleRecover} 
            disabled={isProcessing || !isCrashed}
            className="gap-2 font-mono uppercase tracking-widest border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
          >
            <RotateCcw className="w-4 h-4" />
            Recover WAL
          </Button>
        </div>
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
