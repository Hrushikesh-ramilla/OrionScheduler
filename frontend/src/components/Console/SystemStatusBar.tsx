"use client";

import { useEffect, useRef, useState } from "react";

import { useWebSocket } from "@/hooks/useWebSocket";
import { fetchLiveMetrics } from "@/lib/api";
import { cn } from "@/lib/utils";

type SystemState = "WARMING" | "ONLINE" | "OFFLINE" | "RECOVERING" | "CRASHING" | "BACKEND_OFFLINE";

interface StatusBarProps {
  systemState: SystemState;
  wsStatus: "connecting" | "connected" | "disconnected";
  workerCount?: number;
}

interface LiveMetrics {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  retried: number;
  queue_size: number;
  ws_clients: number;
  uptime_seconds: number;
  workers: number;
  dropped_events: number;
}

const emptyMetrics: LiveMetrics = {
  pending: 0,
  running: 0,
  completed: 0,
  failed: 0,
  retried: 0,
  queue_size: 0,
  ws_clients: 0,
  uptime_seconds: 0,
  workers: 4,
  dropped_events: 0,
};

export function SystemStatusBar({ systemState, wsStatus, workerCount = 4 }: StatusBarProps) {
  const [metrics, setMetrics] = useState<LiveMetrics>(emptyMetrics);
  const [uptime, setUptime] = useState(0);
  const uptimeRef = useRef(0);
  const metricsOnline = systemState === "ONLINE";
  const visual = getStateVisual(systemState);

  useEffect(() => {
    if (!metricsOnline) return;
    fetchLiveMetrics().then(setMetrics).catch(() => {});
  }, [metricsOnline]);

  useEffect(() => {
    if (!metricsOnline) {
      setUptime(0);
      return;
    }

    uptimeRef.current = metrics.uptime_seconds;
    setUptime(uptimeRef.current);
    const interval = setInterval(() => {
      uptimeRef.current += 1;
      setUptime(uptimeRef.current);
    }, 1000);

    return () => clearInterval(interval);
  }, [metricsOnline, metrics.uptime_seconds]);

  useWebSocket({
    onMessage: (event: any) => {
      if (event.type === "metrics.update" && event.metadata) {
        const m = event.metadata;
        setMetrics((prev) => ({
          ...prev,
          pending: parseInt(m.pending ?? "0", 10),
          running: parseInt(m.running ?? "0", 10),
          completed: parseInt(m.completed ?? "0", 10),
          failed: parseInt(m.failed ?? "0", 10),
          retried: parseInt(m.retried ?? "0", 10),
          queue_size: parseInt(m.queue_size ?? "0", 10),
          dropped_events: parseInt(m.dropped_events ?? "0", 10),
        }));
      }
    },
  });

  const workerTotal = metrics.workers || workerCount;
  const activeWorkers = metricsOnline ? metrics.running : 0;
  const valueOrDash = (value: number) => metricsOnline ? value.toString() : "--";

  return (
    <div className="h-8 flex items-center bg-[hsl(220,22%,7%)] border-b border-border px-3 gap-0 shrink-0 select-none overflow-hidden">
      <div className="flex items-center gap-1.5 pr-3 border-r border-border mr-3">
        <div className="text-[10px] font-bold tracking-[0.2em] text-primary">ORION</div>
        <div className="text-[9px] text-muted-foreground tracking-widest">ORCHESTRATOR</div>
      </div>

      <div className={cn("flex items-center gap-1.5 pr-3 border-r border-border mr-3", visual.text)}>
        <span className={cn("w-1.5 h-1.5 rounded-full", visual.dot)} />
        <span className="text-[10px] font-bold tracking-widest whitespace-nowrap">{visual.label}</span>
      </div>

      <div className="flex items-center gap-4 text-[10px] font-mono flex-1 min-w-0">
        <MetricPill label="UPTIME" value={metricsOnline ? formatUptime(uptime || metrics.uptime_seconds) : "--:--:--"} />
        <MetricPill label="WORKERS" value={metricsOnline ? `${activeWorkers}/${workerTotal}` : "--"} highlight={activeWorkers > 0} />
        <MetricPill label="QUEUE" value={valueOrDash(metrics.queue_size)} highlight={metrics.queue_size > 0 && metricsOnline} />
        <MetricPill label="RUNNING" value={valueOrDash(metrics.running)} color={metricsOnline ? "text-blue-400" : undefined} />
        <MetricPill label="COMPLETED" value={valueOrDash(metrics.completed)} color={metricsOnline ? "text-emerald-400" : undefined} />
        <MetricPill label="FAILED" value={valueOrDash(metrics.failed)} color={metricsOnline && metrics.failed > 0 ? "text-red-400" : undefined} />
        <MetricPill label="RETRIED" value={valueOrDash(metrics.retried)} color={metricsOnline && metrics.retried > 0 ? "text-amber-400" : undefined} />
        {metricsOnline && metrics.dropped_events > 0 && (
          <MetricPill label="DROPPED" value={metrics.dropped_events.toString()} color="text-orange-400" />
        )}
      </div>

      <div className="flex items-center gap-1.5 pl-3 border-l border-border ml-3">
        <span className={cn(
          "w-1.5 h-1.5 rounded-full",
          wsStatus === "connected" ? "bg-emerald-400 animate-pulse" :
            wsStatus === "connecting" ? "bg-amber-400 animate-pulse" :
              "bg-red-400",
        )} />
        <span className="text-[10px] text-muted-foreground tracking-widest whitespace-nowrap">
          WS:{wsStatus.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <span className="text-muted-foreground/60">{label}</span>
      <span className={cn(
        "tabular-nums",
        color || (highlight ? "text-foreground" : "text-muted-foreground"),
      )}>
        {value}
      </span>
    </div>
  );
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function getStateVisual(systemState: SystemState) {
  switch (systemState) {
    case "WARMING":
      return { label: "WARMING", text: "text-amber-300", dot: "bg-amber-400 animate-pulse" };
    case "ONLINE":
      return { label: "ONLINE", text: "text-emerald-400", dot: "bg-emerald-400 animate-pulse" };
    case "OFFLINE":
      return { label: "SCHEDULER OFFLINE", text: "text-red-400", dot: "bg-red-400" };
    case "RECOVERING":
      return { label: "RECOVERING", text: "text-amber-400", dot: "bg-amber-400 animate-pulse" };
    case "CRASHING":
      return { label: "CRASHING", text: "text-red-500", dot: "bg-red-500 animate-pulse" };
    case "BACKEND_OFFLINE":
      return { label: "BACKEND OFFLINE", text: "text-red-300", dot: "bg-red-500" };
  }
}
