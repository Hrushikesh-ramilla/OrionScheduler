"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { cn } from "@/lib/utils";
import { TaskStatus } from "@/types";

export type TaskNodeData = {
  label: string;
  payload: string;
  status: TaskStatus;
  priority: number;
  workerId?: number;
  retryCount?: number;
  maxRetries?: number;
  duration?: number;
};

const STATUS_CONFIG: Record<TaskStatus, {
  border: string;
  bg: string;
  headerBg: string;
  dot: string;
  label: string;
  labelColor: string;
  reasoning: string;
}> = {
  pending: {
    border: "border-border",
    bg: "bg-[hsl(220,22%,10%)]",
    headerBg: "bg-[hsl(220,22%,12%)]",
    dot: "bg-muted-foreground/40",
    label: "PENDING",
    labelColor: "text-muted-foreground",
    reasoning: "Awaiting backend event. Dependency state is inferred from the visible DAG.",
  },
  running: {
    border: "border-blue-500/60",
    bg: "bg-blue-950/15",
    headerBg: "bg-blue-950/30",
    dot: "bg-blue-400",
    label: "RUNNING",
    labelColor: "text-blue-400",
    reasoning: "Backend reported this task as started and assigned to a worker.",
  },
  completed: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-950/10",
    headerBg: "bg-emerald-950/20",
    dot: "bg-emerald-400",
    label: "DONE",
    labelColor: "text-emerald-400",
    reasoning: "Backend reported this task as completed.",
  },
  failed: {
    border: "border-red-500/50",
    bg: "bg-red-950/15",
    headerBg: "bg-red-950/30",
    dot: "bg-red-400",
    label: "FAILED",
    labelColor: "text-red-400",
    reasoning: "Backend reported permanent failure after retries.",
  },
  retrying: {
    border: "border-amber-500/50",
    bg: "bg-amber-950/15",
    headerBg: "bg-amber-950/25",
    dot: "bg-amber-400",
    label: "RETRYING",
    labelColor: "text-amber-400",
    reasoning: "Backend reported retry/backoff for this task.",
  },
  "cascade-failed": {
    border: "border-orange-500/50",
    bg: "bg-orange-950/15",
    headerBg: "bg-orange-950/25",
    dot: "bg-orange-400",
    label: "CASCADE",
    labelColor: "text-orange-400",
    reasoning: "Backend reported this task in a failure cascade.",
  },
};

export function EnhancedTaskNode({ data, selected }: NodeProps<TaskNodeData>) {
  const cfg = STATUS_CONFIG[data.status ?? "pending"];

  return (
    <div className={cn(
      "rounded border min-w-[160px] max-w-[200px] transition-all duration-300 overflow-hidden",
      cfg.bg, cfg.border,
      data.status === "running" && "glow-blue",
      data.status === "completed" && "glow-emerald",
      data.status === "failed" && "glow-red",
      data.status === "cascade-failed" && "glow-orange",
      data.status === "retrying" && "glow-amber",
      selected && "ring-1 ring-primary ring-offset-1 ring-offset-background",
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-border !border !border-border/80 !rounded-sm"
      />

      {/* Header */}
      <div className={cn("flex items-center justify-between px-2 py-1.5", cfg.headerBg)}>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
            cfg.dot,
            (data.status === "running" || data.status === "retrying") && "animate-pulse"
          )} />
          <span className="text-[11px] font-bold font-mono text-foreground truncate">
            {data.label}
          </span>
        </div>
        <span className={cn("text-[9px] font-bold tracking-wider shrink-0 ml-1", cfg.labelColor)}>
          {cfg.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-2 py-1.5 space-y-1">
        {/* Priority + Payload row */}
        <div className="flex items-center justify-between text-[9px] font-mono">
          <span className="text-muted-foreground/60">priority</span>
          <span className={cn("font-bold",
            data.priority === 1 ? "text-primary" :
            data.priority <= 3 ? "text-amber-400/70" : "text-muted-foreground/50"
          )}>P{data.priority}</span>
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono">
          <span className="text-muted-foreground/60">payload</span>
          <span className={cn("font-bold",
            data.payload === "fail" ? "text-red-400" :
            data.payload === "sleep" ? "text-amber-400" :
            "text-muted-foreground/70"
          )}>{data.payload}</span>
        </div>

        {/* Worker assignment (when running) */}
        {data.workerId && data.status === "running" && (
          <div className="flex items-center justify-between text-[9px] font-mono">
            <span className="text-muted-foreground/60">worker</span>
            <span className="text-violet-400 font-bold">W{data.workerId}</span>
          </div>
        )}

        {/* Retry info (when retrying or failed) */}
        {(data.retryCount != null && data.retryCount > 0) && (
          <div className="flex items-center justify-between text-[9px] font-mono">
            <span className="text-muted-foreground/60">retry</span>
            <span className={cn("font-bold",
              (data.retryCount ?? 0) >= (data.maxRetries ?? 3) ? "text-red-400" : "text-amber-400"
            )}>
              {data.retryCount}/{data.maxRetries ?? 3}
            </span>
          </div>
        )}

        {/* Reasoning tooltip */}
        <div className="pt-1 border-t border-border/30">
          <div className="text-[8.5px] text-muted-foreground/50 leading-tight font-mono">
            {cfg.reasoning}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-border !border !border-border/80 !rounded-sm"
      />
    </div>
  );
}
