"use client";

import { Handle, Position, NodeProps } from "reactflow";
import { cn } from "@/lib/utils";
import { TaskStatus } from "@/types";
import { Clock, AlertTriangle, CheckCircle, Play, Loader2, RefreshCcw } from "lucide-react";

export type TaskNodeData = {
  label: string;
  payload: string;
  status: TaskStatus;
  priority: number;
  duration?: number; // visual demo duration
};

const statusConfig: Record<TaskStatus, { color: string; border: string; bg: string; icon: React.ReactNode }> = {
  pending: {
    color: "text-muted-foreground",
    border: "border-border",
    bg: "bg-card",
    icon: <Clock className="w-4 h-4" />
  },
  running: {
    color: "text-blue-500",
    border: "border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]",
    bg: "bg-blue-500/10",
    icon: <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
  },
  completed: {
    color: "text-emerald-500",
    border: "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]",
    bg: "bg-emerald-500/10",
    icon: <CheckCircle className="w-4 h-4 text-emerald-500" />
  },
  failed: {
    color: "text-destructive",
    border: "border-destructive/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]",
    bg: "bg-destructive/10",
    icon: <AlertTriangle className="w-4 h-4 text-destructive" />
  },
  retrying: {
    color: "text-amber-500",
    border: "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]",
    bg: "bg-amber-500/10",
    icon: <RefreshCcw className="w-4 h-4 animate-spin text-amber-500" />
  }
};

export function TaskNode({ data, selected }: NodeProps<TaskNodeData>) {
  const config = statusConfig[data.status || 'pending'];

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 min-w-[180px] transition-all duration-300",
        config.bg,
        config.border,
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      )}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-muted-foreground border-none" />
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-mono text-sm font-bold">
          {config.icon}
          <span className={config.color}>{data.label}</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-background/50 border">
          P{data.priority}
        </span>
      </div>

      <div className="flex flex-col gap-1 mt-3">
        <div className="text-xs text-muted-foreground flex justify-between">
          <span>Payload</span>
          <span className="font-mono text-foreground">{data.payload}</span>
        </div>
        {data.duration && (
          <div className="text-xs text-muted-foreground flex justify-between tracking-tight">
            <span>Latency (sim)</span>
            <span className="font-mono">{data.duration}ms</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-muted-foreground border-none" />
    </div>
  );
}
