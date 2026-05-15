"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "reactflow";
import { Toaster, toast } from "sonner";

import { ControlSidebar } from "@/components/Console/ControlSidebar";
import { DagCanvas, DagCanvasHandle } from "@/components/Console/DagCanvas";
import { EnhancedEventStream } from "@/components/Console/EnhancedEventStream";
import { SystemInternalsPanel } from "@/components/Console/SystemInternalsPanel";
import { SystemStatusBar } from "@/components/Console/SystemStatusBar";
import { WorkerPoolPanel } from "@/components/Console/WorkerPoolPanel";
import { useWebSocket, WebSocketProvider } from "@/hooks/useWebSocket";
import { adminControlsAvailable, fetchAdminStatus, recoverSystem, simulateCrash } from "@/lib/api";
import { DAG_TEMPLATES } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { TaskEvent } from "@/types";

type SystemState = "WARMING" | "ONLINE" | "OFFLINE" | "RECOVERING" | "CRASHING" | "BACKEND_OFFLINE";

export default function OrchestratorConsole() {
  return (
    <WebSocketProvider>
      <ConsoleShell />
    </WebSocketProvider>
  );
}

function ConsoleShell() {
  const [systemState, setSystemState] = useState<SystemState>("WARMING");
  const [isCrashed, setIsCrashed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasActiveDAG, setHasActiveDAG] = useState(false);
  const [recoverCooldown, setRecoverCooldown] = useState(false);
  const [isAutoDemoRunning, setIsAutoDemoRunning] = useState(false);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminControlsEnabled, setAdminControlsEnabled] = useState(false);

  const dagRef = useRef<DagCanvasHandle>(null);
  const backendMutationInFlight = useRef(false);
  const lastTaskStartedAt = useRef(0);
  const backendUnavailable = systemState === "WARMING" || systemState === "BACKEND_OFFLINE";

  useWebSocket({
    onMessage: (event: TaskEvent) => {
      if (event.type === "task.started") {
        lastTaskStartedAt.current = Date.now();
      }
    },
  });

  const syncBackendStatus = useCallback(async () => {
    if (backendMutationInFlight.current) return;

    try {
      const status = await fetchAdminStatus();
      setIsCrashed(!status.running);
      setSystemState(status.running ? "ONLINE" : "OFFLINE");
    } catch {
      setIsCrashed(false);
      setSystemState("BACKEND_OFFLINE");
    }
  }, []);

  useEffect(() => {
    syncBackendStatus();
    const interval = setInterval(syncBackendStatus, 5000);
    return () => clearInterval(interval);
  }, [syncBackendStatus]);

  useEffect(() => {
    setAdminControlsEnabled(adminControlsAvailable());
  }, []);

  const handleCrash = useCallback(async () => {
    if (!adminControlsEnabled) {
      toast.error("Crash control requires a demo token.", { duration: 3500 });
      return;
    }
    if (backendUnavailable) {
      toast.error("Backend is not reachable yet. Demo controls are paused.", { duration: 3500 });
      return;
    }

    backendMutationInFlight.current = true;
    try {
      setIsProcessing(true);
      setSystemState("CRASHING");
      await simulateCrash();
      setIsCrashed(true);
      setSystemState("OFFLINE");
      toast.error("Crash command accepted. Scheduler is offline.", { duration: 4000 });
      await new Promise((resolve) => setTimeout(resolve, 1200));
    } catch (err: any) {
      toast.error(err.message || "Failed to simulate crash");
      backendMutationInFlight.current = false;
      setSystemState("WARMING");
      await syncBackendStatus();
    } finally {
      backendMutationInFlight.current = false;
      setIsProcessing(false);
    }
  }, [adminControlsEnabled, backendUnavailable, syncBackendStatus]);

  const handleRecover = useCallback(async () => {
    if (!adminControlsEnabled) {
      toast.error("Recovery control requires a demo token.", { duration: 3500 });
      return;
    }
    if (backendUnavailable) {
      toast.error("Backend is not reachable yet. Recovery is unavailable.", { duration: 3500 });
      return;
    }

    backendMutationInFlight.current = true;
    try {
      setIsProcessing(true);
      setSystemState("RECOVERING");
      toast.info("Requesting scheduler recovery...", { duration: 3000 });
      await recoverSystem();
      setIsCrashed(false);
      setSystemState("ONLINE");
      toast.success("Recovery command completed. See events for replay details.", { duration: 4000 });
      setRecoverCooldown(true);
      setTimeout(() => setRecoverCooldown(false), 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to recover system");
      backendMutationInFlight.current = false;
      setSystemState("WARMING");
      await syncBackendStatus();
    } finally {
      backendMutationInFlight.current = false;
      setIsProcessing(false);
    }
  }, [adminControlsEnabled, backendUnavailable, syncBackendStatus]);

  const handleAutoDemo = useCallback(async () => {
    if (!dagRef.current) return;
    if (!adminControlsEnabled) {
      toast.error("Auto demo requires a demo token for crash/recovery.", { duration: 3500 });
      return;
    }
    if (backendUnavailable) {
      toast.error("Backend is not reachable yet. Auto demo is paused.", { duration: 3500 });
      return;
    }

    const template = DAG_TEMPLATES.complex;
    const demoStartedAt = Date.now();
    try {
      setIsAutoDemoRunning(true);
      dagRef.current.loadTemplate(template.id);
      toast.info(
        `AUTO DEMO: Loaded ${template.name} (${template.nodes.length} tasks, ${template.edges.length} dependencies).`,
        { duration: 3000 },
      );
      await new Promise((resolve) => setTimeout(resolve, 800));

      setIsSubmitting(true);
      const accepted = await dagRef.current.handleSubmit();
      if (!accepted) {
        throw new Error("DAG submission was rejected by the backend.");
      }
      setHasActiveDAG(true);
      setIsSubmitting(false);
      toast.info("AUTO DEMO: Submit accepted. Waiting for first worker event.", { duration: 3000 });
      const sawTaskStart = await waitForEvidence(() => lastTaskStartedAt.current >= demoStartedAt, 4000);
      if (!sawTaskStart) {
        throw new Error("No task.started event arrived after submit.");
      }

      toast.warning("AUTO DEMO: Sending crash command.", { duration: 3000 });
      await handleCrash();
      const crashObserved = await waitForEvidence(async () => {
        const status = await fetchAdminStatus();
        return !status.running;
      }, 4000);
      if (!crashObserved) {
        throw new Error("Backend did not confirm scheduler crash.");
      }

      toast.info("AUTO DEMO: Sending recovery command.", { duration: 3000 });
      await handleRecover();
      const recoveryObserved = await waitForEvidence(async () => {
        const status = await fetchAdminStatus();
        return status.running;
      }, 5000);
      if (!recoveryObserved) {
        throw new Error("Backend did not confirm scheduler recovery.");
      }

      toast.success("AUTO DEMO: Recovery command finished. Event stream shows backend details.", { duration: 5000 });
    } catch {
      toast.error("AUTO DEMO stopped before crash or recovery.", { duration: 4000 });
    } finally {
      setIsAutoDemoRunning(false);
      setIsSubmitting(false);
    }
  }, [adminControlsEnabled, backendUnavailable, handleCrash, handleRecover]);

  const handleLoadTemplate = useCallback((id: string) => {
    dagRef.current?.loadTemplate(id);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!dagRef.current) return;
    if (backendUnavailable || isCrashed) {
      toast.error("Backend or scheduler is unavailable. DAG was not submitted.", { duration: 3500 });
      return;
    }

    setIsSubmitting(true);
    try {
      const accepted = await dagRef.current.handleSubmit();
      if (accepted) setHasActiveDAG(true);
    } catch {
      // DagCanvas already shows the backend error; keep this handler quiet.
    } finally {
      setIsSubmitting(false);
    }
  }, [backendUnavailable, isCrashed]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "hsl(220,22%,9%)",
            border: "1px solid hsl(220,15%,20%)",
            color: "hsl(210,20%,92%)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            borderRadius: "2px",
          },
        }}
      />

      <SystemStatusBar
        systemState={systemState}
        wsStatus={wsStatus}
      />

      {systemState === "BACKEND_OFFLINE" && (
        <div className="shrink-0 px-4 py-2 flex items-center gap-3 bg-red-950/35 border-b border-red-500/35">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[11px] font-bold tracking-widest text-red-300">
            BACKEND OFFLINE - controls that call the API are disabled
          </span>
        </div>
      )}

      {systemState === "WARMING" && (
        <div className="shrink-0 px-4 py-2 flex items-center gap-3 bg-amber-950/30 border-b border-amber-500/30">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-bold tracking-widest text-amber-300">
            CHECKING BACKEND - API controls will enable after status returns
          </span>
        </div>
      )}

      {isCrashed && systemState === "OFFLINE" && (
        <div className={cn(
          "shrink-0 px-4 py-2 flex items-center gap-3 bg-red-950/40 border-b border-red-500/40",
          "crash-flash",
        )}>
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] font-bold tracking-widest text-red-400">
            SCHEDULER OFFLINE - backend is reachable, scheduler reports stopped
          </span>
          <button
            onClick={handleRecover}
            disabled={isProcessing || backendUnavailable || !adminControlsEnabled}
            className="ml-auto text-[10px] border border-emerald-500/50 text-emerald-400 px-3 py-1 hover:bg-emerald-950/30 transition-all disabled:opacity-50"
          >
            REQUEST RECOVERY
          </button>
        </div>
      )}

      {systemState === "RECOVERING" && !isCrashed && (
        <div className="shrink-0 px-4 py-2 flex items-center gap-3 bg-amber-950/30 border-b border-amber-500/30">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-bold tracking-widest text-amber-400">
            RECOVERY REQUEST IN FLIGHT - waiting for backend result
          </span>
        </div>
      )}

      <ReactFlowProvider>
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="w-52 shrink-0 border-r border-border overflow-y-auto overflow-x-hidden">
            <ControlSidebar
              systemState={systemState}
              backendAvailable={!backendUnavailable}
              adminControlsEnabled={adminControlsEnabled}
              isCrashed={isCrashed}
              isProcessing={isProcessing}
              isAutoDemoRunning={isAutoDemoRunning}
              hasActiveDAG={hasActiveDAG}
              recoverCooldown={recoverCooldown}
              onCrash={handleCrash}
              onRecover={handleRecover}
              onAutoDemo={handleAutoDemo}
              onLoadTemplate={handleLoadTemplate}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              wsStatus={wsStatus}
            />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="flex-1 overflow-hidden relative">
              <div className="absolute top-2 left-3 z-10 text-[9px] text-muted-foreground/40 tracking-widest select-none pointer-events-none">
                DAG EXECUTION CANVAS
              </div>
              <DagCanvas
                ref={dagRef}
                onSubmitSuccess={() => setHasActiveDAG(true)}
                onWsStatusChange={setWsStatus}
              />
            </div>

            <div className="h-52 shrink-0 border-t border-border">
              <EnhancedEventStream showMetricsTicks={false} />
            </div>
          </div>

          <div className="w-56 shrink-0 border-l border-border flex flex-col overflow-hidden">
            <div className="border-b border-border overflow-hidden" style={{ flex: "2 1 0" }}>
              <WorkerPoolPanel />
            </div>
            <div className="overflow-hidden min-h-0" style={{ flex: "3 1 0" }}>
              <SystemInternalsPanel />
            </div>
          </div>
        </div>
      </ReactFlowProvider>
    </div>
  );
}

async function waitForEvidence(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  intervalMs = 100,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return true;
    } catch {
      // Keep polling until timeout; transient fetch failures are expected during crash/recover.
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}
