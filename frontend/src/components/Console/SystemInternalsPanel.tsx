"use client";

import { useEffect, useMemo, useState } from "react";
import { useEdges, useNodes } from "reactflow";

import { useWebSocket } from "@/hooks/useWebSocket";
import { cn } from "@/lib/utils";
import { TaskEvent, TaskStatus } from "@/types";

interface DependencyEntry {
  taskId: string;
  remaining: number;
  incoming: number;
  status: TaskStatus;
}

interface ObservedEventEntry {
  type: "DAG_SUBMIT" | "TASK_START" | "TASK_DONE" | "TASK_FAIL" | "CASCADE" | "RECOVER" | "CRASH";
  taskId?: string;
  taskCount?: number;
  timestamp: string;
}

interface RetryTimer {
  taskId: string;
  attempt: number;
  maxRetries: number;
  delaySeconds: number;
  startedAt: number;
}

export function SystemInternalsPanel() {
  const nodes = useNodes();
  const edges = useEdges();
  const [eventEntries, setEventEntries] = useState<ObservedEventEntry[]>([]);
  const [retryTimers, setRetryTimers] = useState<RetryTimer[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const dependencyEntries = useMemo<DependencyEntry[]>(() => {
    const statusById = new Map<string, TaskStatus>(
      nodes.map((node) => [node.id, ((node.data as any)?.status ?? "pending") as TaskStatus]),
    );

    return nodes.map((node) => {
      const incomingEdges = edges.filter((edge) => edge.target === node.id);
      const completedDependencies = incomingEdges.filter((edge) => statusById.get(edge.source) === "completed").length;
      const status = ((node.data as any)?.status ?? "pending") as TaskStatus;
      const terminalOrStarted = ["running", "completed", "failed", "cascade-failed"].includes(status);

      return {
        taskId: node.id,
        incoming: incomingEdges.length,
        remaining: terminalOrStarted ? 0 : Math.max(0, incomingEdges.length - completedDependencies),
        status,
      };
    });
  }, [edges, nodes]);

  useWebSocket({
    onMessage: (event: TaskEvent) => {
      const timestamp = new Date(event.timestamp).toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const addEntry = (entry: ObservedEventEntry) => {
        setEventEntries((prev) => [...prev.slice(-99), entry]);
      };

      if (event.type === "dag.submitted") {
        addEntry({ type: "DAG_SUBMIT", taskCount: event.dag_tasks?.length ?? 0, timestamp });
      }

      if (event.type === "task.started") {
        addEntry({ type: "TASK_START", taskId: event.task_id, timestamp });
      }

      if (event.type === "task.completed") {
        addEntry({ type: "TASK_DONE", taskId: event.task_id, timestamp });
      }

      if (event.type === "task.failed") {
        addEntry({ type: "TASK_FAIL", taskId: event.task_id, timestamp });
      }

      if (event.type === "task.retry" && event.task_id) {
        const taskId = event.task_id;
        const delay = retryDelaySeconds(event.retry ?? 1);
        setRetryTimers((prev) => [
          ...prev.filter((timer) => timer.taskId !== taskId),
          {
            taskId,
            attempt: event.retry ?? 0,
            maxRetries: event.max_retry ?? 3,
            delaySeconds: delay,
            startedAt: Date.now(),
          },
        ]);
      }

      if (event.type === "task.started" && event.task_id) {
        setRetryTimers((prev) => prev.filter((timer) => timer.taskId !== event.task_id));
      }

      if (event.type === "task.cascade" && event.dag_tasks) {
        event.dag_tasks.forEach((taskId) => {
          addEntry({ type: "CASCADE", taskId, timestamp });
        });
      }

      if (event.type === "metrics.update" && event.metadata) {
        setQueueSize(parseInt(event.metadata.queue_size ?? "0", 10));
      }

      if (event.type === "system.crash") {
        addEntry({ type: "CRASH", timestamp });
        setRetryTimers([]);
      }

      if (event.type === "system.recover") {
        addEntry({ type: "RECOVER", timestamp });
        setRetryTimers([]);
      }
    },
  });

  return (
    <div className="flex flex-col h-full bg-[hsl(220,22%,9%)] overflow-hidden divide-y divide-border">
      <div className="flex flex-col min-h-0" style={{ flex: "1 1 0" }}>
        <div className="px-3 py-1.5 bg-[hsl(220,22%,8%)] shrink-0">
          <span className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground">OBSERVED EVENTS</span>
          <span className="text-[9px] text-muted-foreground/40 ml-2">from WebSocket</span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-1">
          {eventEntries.length === 0 ? (
            <div className="text-[10px] text-muted-foreground/30 py-2 text-center">No backend events yet</div>
          ) : (
            eventEntries.slice().reverse().slice(0, 30).map((entry, i) => (
              <div key={`${entry.timestamp}-${entry.type}-${entry.taskId ?? i}`} className="flex items-center gap-2 py-0.5 text-[10px] font-mono">
                <span className="text-muted-foreground/30 shrink-0 tabular-nums">{entry.timestamp}</span>
                <span className={cn("shrink-0 font-bold", eventTypeColor(entry.type))}>
                  {entry.type.padEnd(10)}
                </span>
                <span className="text-muted-foreground/70 truncate">
                  {entry.taskId ?? (entry.taskCount != null ? `${entry.taskCount} tasks` : "")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col min-h-0" style={{ flex: "1 1 0" }}>
        <div className="px-3 py-1.5 bg-[hsl(220,22%,8%)] shrink-0">
          <span className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground">CANVAS DEPS</span>
          <span className="text-[9px] text-muted-foreground/40 ml-2">derived view</span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-1">
          {dependencyEntries.length === 0 ? (
            <div className="text-[10px] text-muted-foreground/30 py-2 text-center">No nodes on canvas</div>
          ) : (
            dependencyEntries.map((entry) => (
              <div key={entry.taskId} className="flex items-center gap-2 py-0.5 text-[10px] font-mono">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dependencyDot(entry.status))} />
                <span className="text-foreground/70 truncate min-w-0 flex-1">{entry.taskId}</span>
                <span className={cn("text-[9px] shrink-0 tabular-nums font-bold", dependencyTextColor(entry))}>
                  {dependencyLabel(entry)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col shrink-0">
        <div className="px-3 py-1.5 bg-[hsl(220,22%,8%)]">
          <span className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground">QUEUE DEPTH</span>
          <span className={cn("text-[10px] font-bold tabular-nums ml-2", queueColor(queueSize))}>
            {queueSize}
          </span>
          <span className="text-[9px] text-muted-foreground/40 ml-1">reported</span>
          <div className="mt-1 h-0.5 bg-border rounded-full overflow-hidden mx-3">
            <div
              className={cn("h-full rounded-full transition-all duration-300", queueBarColor(queueSize))}
              style={{ width: `${Math.min((queueSize / 50) * 100, 100)}%` }}
            />
          </div>
        </div>

        {retryTimers.length > 0 && (
          <div className="px-3 pb-2">
            <div className="text-[9px] text-amber-400/70 mb-1 mt-1.5">RETRY TIMERS</div>
            {retryTimers.map((timer) => {
              const elapsed = (now - timer.startedAt) / 1000;
              const remaining = Math.max(0, timer.delaySeconds - elapsed);
              const pct = Math.min((elapsed / timer.delaySeconds) * 100, 100);
              return (
                <div key={timer.taskId} className="mb-1">
                  <div className="flex justify-between text-[9px] font-mono mb-0.5">
                    <span className="text-amber-400/80 truncate">{timer.taskId}</span>
                    <span className="text-muted-foreground/50 shrink-0">
                      retry {timer.attempt}/{timer.maxRetries} - {remaining.toFixed(1)}s
                    </span>
                  </div>
                  <div className="h-0.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function retryDelaySeconds(attempt: number) {
  return Math.min(Math.pow(2, attempt), 30);
}

function eventTypeColor(type: ObservedEventEntry["type"]) {
  switch (type) {
    case "DAG_SUBMIT":
      return "text-violet-400";
    case "TASK_START":
      return "text-blue-400";
    case "TASK_DONE":
      return "text-emerald-400";
    case "CASCADE":
      return "text-orange-400";
    case "RECOVER":
      return "text-emerald-400";
    case "CRASH":
    case "TASK_FAIL":
      return "text-red-400";
  }
}

function dependencyDot(status: TaskStatus) {
  switch (status) {
    case "running":
      return "bg-blue-400 animate-pulse";
    case "completed":
      return "bg-emerald-400";
    case "failed":
      return "bg-red-400";
    case "cascade-failed":
      return "bg-orange-400";
    case "retrying":
      return "bg-amber-400 animate-pulse";
    case "pending":
    default:
      return "bg-muted-foreground/30";
  }
}

function dependencyTextColor(entry: DependencyEntry) {
  if (entry.status === "completed") return "text-emerald-400";
  if (entry.status === "running") return "text-blue-400";
  if (entry.status === "failed" || entry.status === "cascade-failed") return "text-red-400";
  if (entry.status === "retrying") return "text-amber-400";
  if (entry.remaining === 0) return "text-amber-400";
  return "text-muted-foreground";
}

function dependencyLabel(entry: DependencyEntry) {
  if (entry.status === "running") return "RUN";
  if (entry.status === "completed") return "DONE";
  if (entry.status === "failed") return "FAIL";
  if (entry.status === "cascade-failed") return "CASCADE";
  if (entry.status === "retrying") return "RETRY";
  if (entry.remaining === 0) return "READY";
  return `wait:${entry.remaining}/${entry.incoming}`;
}

function queueColor(queueSize: number) {
  if (queueSize > 30) return "text-red-400";
  if (queueSize > 10) return "text-amber-400";
  return "text-emerald-400";
}

function queueBarColor(queueSize: number) {
  if (queueSize > 40) return "bg-red-500";
  if (queueSize > 20) return "bg-amber-500";
  return "bg-emerald-500";
}
