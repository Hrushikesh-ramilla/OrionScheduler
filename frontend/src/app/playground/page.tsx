"use client";

import { useState } from "react";
import { ReactFlowProvider } from "reactflow";
import { DagBuilder } from "@/components/Playground/DagBuilder";
import { NodeConfigPanel } from "@/components/Playground/NodeConfigPanel";
import { EventLog } from "@/components/Playground/EventLog";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { simulateCrash, recoverSystem } from "@/lib/api";
import { AlertOctagon, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function PlaygroundPage() {
  const [isCrashed, setIsCrashed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasActiveDAG, setHasActiveDAG] = useState(false);
  const [recoverCooldown, setRecoverCooldown] = useState(false);

  const handleCrash = async () => {
    try {
      setIsProcessing(true);
      await simulateCrash();
      setIsCrashed(true);
      toast.success("Crash signal sent! System offline.");
      
      // Dramatic pause block (Commit 52)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
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
      toast.success("Recovery signal sent! WAL replaying...");
      
      // Prevent rapid cycle: 2s cooldown before crash can be triggered again
      setRecoverCooldown(true);
      setTimeout(() => setRecoverCooldown(false), 2000);
      
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
            disabled={isProcessing || isCrashed || !hasActiveDAG || recoverCooldown}
            className="gap-2 font-mono uppercase tracking-widest font-bold"
            title={!hasActiveDAG ? "Submit a DAG first" : recoverCooldown ? "Cooldown..." : undefined}
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

      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence>
          {isCrashed && (
            <motion.div 
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-destructive/20 border-destructive rounded-lg border-2 shadow-[inset_0_0_100px_rgba(239,68,68,0.2)]"
            >
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="bg-background/95 p-8 rounded-xl border-destructive border-2 shadow-2xl flex flex-col items-center max-w-sm text-center"
              >
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4 text-destructive">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold font-mono text-destructive tracking-widest mb-2">SYSTEM OFFLINE</h3>
                <p className="text-sm text-muted-foreground mb-6">The scheduler node has been gracefully terminated. Memory state is wiped. Only WAL remains.</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="w-full h-full bg-card border rounded-lg overflow-hidden shadow-sm min-h-0">
          <ReactFlowProvider>
            {/* @ts-ignore - shadcn resizable panel group types mismatch in v4 */}
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={70}>
                {/* @ts-ignore */}
                <ResizablePanelGroup direction="horizontal">
                  <ResizablePanel defaultSize={75} minSize={50}>
                    <DagBuilder onSubmitSuccess={() => setHasActiveDAG(true)} />
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
    </div>
  );
}
