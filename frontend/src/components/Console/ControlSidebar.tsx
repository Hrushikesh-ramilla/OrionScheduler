"use client";

import { useState } from "react";
import { useNodes, useReactFlow } from "reactflow";

import { DAG_TEMPLATES } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { TaskNodeData } from "./EnhancedTaskNode";

export type ControlSidebarHandle = {
  triggerCrash: () => Promise<void>;
  triggerRecover: () => Promise<void>;
  triggerAutoDemo: () => Promise<void>;
};

type SystemState = "WARMING" | "ONLINE" | "OFFLINE" | "RECOVERING" | "CRASHING" | "BACKEND_OFFLINE";

type ControlSidebarProps = {
  systemState: SystemState;
  backendAvailable: boolean;
  adminControlsEnabled: boolean;
  isCrashed: boolean;
  isProcessing: boolean;
  isAutoDemoRunning: boolean;
  hasActiveDAG: boolean;
  recoverCooldown: boolean;
  onCrash: () => Promise<void>;
  onRecover: () => Promise<void>;
  onAutoDemo: () => Promise<void>;
  onLoadTemplate: (id: string) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  wsStatus: "connecting" | "connected" | "disconnected";
};

export function ControlSidebar({
  systemState,
  backendAvailable,
  adminControlsEnabled,
  isCrashed,
  isProcessing,
  isAutoDemoRunning,
  hasActiveDAG,
  recoverCooldown,
  onCrash,
  onRecover,
  onAutoDemo,
  onLoadTemplate,
  onSubmit,
  isSubmitting,
  wsStatus,
}: ControlSidebarProps) {
  const [selectedTemplate, setSelectedTemplate] = useState("complex");
  const [showGuarantees, setShowGuarantees] = useState(true);
  const { setNodes } = useReactFlow();
  const nodes = useNodes();
  const selectedNode = nodes.find((n) => n.selected);
  const selectedData = selectedNode?.data as TaskNodeData | undefined;

  const submitDisabled = isSubmitting || isCrashed || !backendAvailable;
  const adminUnavailable = !backendAvailable || !adminControlsEnabled;
  const autoDemoDisabled = isProcessing || isCrashed || isAutoDemoRunning || adminUnavailable;
  const crashDisabled = isProcessing || isCrashed || !hasActiveDAG || recoverCooldown || adminUnavailable;
  const recoverDisabled = isProcessing || !isCrashed || adminUnavailable;
  const disabledTitle = !backendAvailable
    ? "Waiting for backend API"
    : !adminControlsEnabled
      ? "Demo token required for crash/recovery controls"
    : isCrashed
      ? "Scheduler is offline"
      : undefined;

  const statusView = getStatusView(systemState, backendAvailable, isCrashed);

  const handleTemplateChange = (id: string) => {
    setSelectedTemplate(id);
    onLoadTemplate(id);
  };

  const updateNodeData = (key: string, value: any) => {
    setNodes((prev) => prev.map((n) =>
      n.id === selectedNode?.id
        ? { ...n, data: { ...n.data, [key]: value } }
        : n,
    ));
  };

  const handleAddNode = () => {
    const newId = `T${nodes.length + 1}`;
    setNodes((prev) => [...prev, {
      id: newId,
      type: "task",
      position: { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 },
      data: { label: newId, payload: "work", status: "pending", priority: 1 },
    }]);
  };

  const handleDeleteNode = () => {
    if (selectedNode) {
      setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-[hsl(220,22%,9%)] divide-y divide-border">
      <div className="px-3 py-2 bg-[hsl(220,22%,8%)] shrink-0">
        <div className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground">CONTROL PANEL</div>
      </div>

      <div className={cn("px-3 py-2 shrink-0 flex items-center justify-between", statusView.bg)}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-2 h-2 rounded-full shrink-0", statusView.dot)} />
          <span className={cn("text-[10px] font-bold tracking-wider truncate", statusView.text)}>
            {statusView.label}
          </span>
        </div>
        <div className={cn("text-[9px] shrink-0", wsStatus === "connected" ? "text-emerald-400/60" : "text-muted-foreground/40")}>
          WS:{wsStatus === "connected" ? "ON" : wsStatus === "connecting" ? "..." : "OFF"}
        </div>
      </div>

      <div className="px-3 py-2 shrink-0">
        <div className="text-[9px] text-muted-foreground/60 tracking-widest mb-1.5">DAG TEMPLATE</div>
        <div className="grid grid-cols-1 gap-1">
          {Object.values(DAG_TEMPLATES).map((t) => (
            <button
              key={t.id}
              onClick={() => handleTemplateChange(t.id)}
              className={cn(
                "text-left px-2 py-1.5 rounded text-[10px] border transition-all",
                selectedTemplate === t.id
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-transparent border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <div className="font-bold">{t.name}</div>
              <div className="text-[9px] opacity-60">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-2 shrink-0">
        <button
          onClick={onSubmit}
          disabled={submitDisabled}
          title={disabledTitle}
          className={cn(
            "w-full py-2 rounded text-[11px] font-bold tracking-widest border transition-all",
            submitDisabled
              ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
              : "border-primary/50 text-primary hover:bg-primary/10 hover:border-primary",
          )}
        >
          {isSubmitting ? "SUBMITTING..." : "SUBMIT DAG"}
        </button>
      </div>

      <div className="px-3 py-2 shrink-0">
        <div className="text-[9px] text-muted-foreground/60 tracking-widest mb-1.5">NODE EDITOR</div>
        {!selectedNode ? (
          <div className="text-[10px] text-muted-foreground/40 text-center py-2">
            Select a node on canvas
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="text-[9px] text-muted-foreground/60 tracking-widest block mb-1">TASK ID</label>
              <input
                value={selectedData?.label ?? ""}
                onChange={(e) => updateNodeData("label", e.target.value)}
                className="w-full bg-[hsl(220,25%,6%)] border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground/60 tracking-widest block mb-1">PAYLOAD</label>
              <select
                value={selectedData?.payload ?? "work"}
                onChange={(e) => updateNodeData("payload", e.target.value)}
                className="w-full bg-[hsl(220,25%,6%)] border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground focus:border-primary outline-none"
              >
                <option value="work">work (short task)</option>
                <option value="sleep">sleep (about 2s)</option>
                <option value="fail">fail (simulated failure)</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground/60 tracking-widest block mb-1">PRIORITY (1=highest)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={selectedData?.priority ?? 1}
                onChange={(e) => updateNodeData("priority", parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[hsl(220,25%,6%)] border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground focus:border-primary outline-none"
              />
            </div>
          </div>
        )}
        <div className="flex gap-1.5 mt-2">
          <button
            onClick={handleAddNode}
            className="flex-1 py-1 border border-border/50 rounded text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-all"
          >
            ADD
          </button>
          <button
            onClick={handleDeleteNode}
            disabled={!selectedNode}
            className="flex-1 py-1 border border-border/50 rounded text-[10px] text-muted-foreground hover:border-red-500/50 hover:text-red-400 transition-all disabled:opacity-30"
          >
            DEL
          </button>
        </div>
      </div>

      <div className="px-3 py-2 shrink-0">
        <button
          onClick={() => setShowGuarantees((open) => !open)}
          className="flex w-full items-center justify-between text-left text-[9px] font-bold tracking-[0.12em] text-muted-foreground/70 hover:text-muted-foreground"
        >
          <span>GUARANTEES / TRADEOFFS</span>
          <span className="font-mono">{showGuarantees ? "-" : "+"}</span>
        </button>
        {showGuarantees && (
          <div className="mt-2 space-y-2 rounded border border-border/60 bg-[hsl(220,25%,6%)] p-2 text-[9px] leading-snug text-muted-foreground/70">
            <div>
              <div className="font-bold text-foreground/70">Single-node demo</div>
              <p>UI observes one backend process over REST and one shared WebSocket connection.</p>
            </div>
            <div>
              <div className="font-bold text-foreground/70">Shown guarantees</div>
              <p>Accepted DAGs, task events, failures, cascades, and recovery summaries are backend-reported.</p>
            </div>
            <div>
              <div className="font-bold text-foreground/70">Tradeoffs</div>
              <p>Dependency and event-log panels are derived views, not direct reads from the WAL file.</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-3 mt-auto shrink-0">
        <div className="text-[9px] text-muted-foreground/60 tracking-widest mb-2">FAULT INJECTION</div>
        {!adminControlsEnabled && backendAvailable && (
          <div className="mb-2 rounded border border-amber-500/25 bg-amber-950/20 px-2 py-1.5 text-[9px] leading-snug text-amber-200/70">
            Demo token required for crash and recovery controls.
          </div>
        )}
        <div className="space-y-1.5">
          <button
            onClick={onAutoDemo}
            disabled={autoDemoDisabled}
            title={disabledTitle}
            className={cn(
              "w-full py-2 rounded text-[11px] font-bold tracking-widest border transition-all",
              isAutoDemoRunning
                ? "border-violet-500/50 text-violet-400 bg-violet-950/20"
                : autoDemoDisabled
                  ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
                  : "border-violet-500/40 text-violet-400 hover:bg-violet-950/20 hover:border-violet-500",
            )}
          >
            {isAutoDemoRunning ? "DEMO RUNNING" : "AUTO DEMO"}
          </button>
          <button
            onClick={onCrash}
            disabled={crashDisabled}
            title={disabledTitle}
            className={cn(
              "w-full py-2 rounded text-[11px] font-bold tracking-widest border transition-all",
              crashDisabled
                ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
                : "border-red-500/50 text-red-400 hover:bg-red-950/20 hover:border-red-500",
            )}
          >
            SIMULATE CRASH
          </button>
          <button
            onClick={onRecover}
            disabled={recoverDisabled}
            title={disabledTitle}
            className={cn(
              "w-full py-2 rounded text-[11px] font-bold tracking-widest border transition-all",
              recoverDisabled
                ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
                : "border-emerald-500/50 text-emerald-400 hover:bg-emerald-950/20 hover:border-emerald-500",
            )}
          >
            REQUEST RECOVERY
          </button>
        </div>
      </div>
    </div>
  );
}

function getStatusView(systemState: SystemState, backendAvailable: boolean, isCrashed: boolean) {
  if (!backendAvailable && systemState === "WARMING") {
    return {
      label: "BACKEND WARMING",
      bg: "bg-amber-950/20",
      dot: "bg-amber-400 animate-pulse",
      text: "text-amber-300",
    };
  }

  if (!backendAvailable) {
    return {
      label: "BACKEND OFFLINE",
      bg: "bg-red-950/30",
      dot: "bg-red-500",
      text: "text-red-300",
    };
  }

  if (isCrashed || systemState === "OFFLINE") {
    return {
      label: "SCHEDULER OFFLINE",
      bg: "bg-red-950/30",
      dot: "bg-red-500 animate-pulse",
      text: "text-red-400",
    };
  }

  if (systemState === "RECOVERING" || systemState === "CRASHING") {
    return {
      label: systemState,
      bg: "bg-amber-950/20",
      dot: "bg-amber-400 animate-pulse",
      text: "text-amber-300",
    };
  }

  return {
    label: "SCHEDULER ONLINE",
    bg: "bg-emerald-950/10",
    dot: "bg-emerald-500 animate-pulse",
    text: "text-emerald-400",
  };
}
