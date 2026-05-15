"use client";

import { useEffect, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { TaskEvent } from "@/types";
import { cn } from "@/lib/utils";

interface WorkerState {
  id: number;
  status: "IDLE" | "EXECUTING" | "COMPLETED";
  currentTask: string | null;
  startedAt: number | null;
  completedCount: number;
}

const WORKER_COUNT = 4;

function initWorkers(): WorkerState[] {
  return Array.from({ length: WORKER_COUNT }, (_, i) => ({
    id: i + 1,
    status: "IDLE",
    currentTask: null,
    startedAt: null,
    completedCount: 0,
  }));
}

export function WorkerPoolPanel() {
  const [workers, setWorkers] = useState<WorkerState[]>(initWorkers());
  const [now, setNow] = useState(Date.now());

  // Tick clock for progress bars
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  useWebSocket({
    onMessage: (event: TaskEvent) => {
      if (event.type === "task.started" && event.worker_id) {
        const wid = event.worker_id;
        setWorkers(prev => prev.map(w =>
          w.id === wid
            ? { ...w, status: "EXECUTING", currentTask: event.task_id ?? null, startedAt: Date.now() }
            : w
        ));
      }

      if (event.type === "task.completed" && event.worker_id) {
        const wid = event.worker_id;
        setWorkers(prev => prev.map(w =>
          w.id === wid ? { ...w, status: "COMPLETED" } : w
        ));
        setTimeout(() => {
          setWorkers(prev => prev.map(w =>
            w.id === wid
              ? { ...w, status: "IDLE", currentTask: null, startedAt: null, completedCount: w.completedCount + 1 }
              : w
          ));
        }, 400);
      }

      if ((event.type === "task.failed" || event.type === "task.retry") && event.worker_id) {
        const wid = event.worker_id;
        setWorkers(prev => prev.map(w =>
          w.id === wid
            ? { ...w, status: "IDLE", currentTask: null, startedAt: null }
            : w
        ));
      }

      // On system crash, reset all workers
      if (event.type === "system.crash") {
        setWorkers(initWorkers());
      }
    }
  });

  return (
    <div className="flex flex-col h-full bg-[hsl(220,22%,9%)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-[hsl(220,22%,8%)] shrink-0">
        <span className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground">WORKER POOL</span>
        <span className="text-[9px] text-muted-foreground/50 ml-auto">
          {workers.filter(w => w.status !== "IDLE").length}/{WORKER_COUNT} active
        </span>
      </div>

      <div className="flex-1 p-3 grid grid-rows-4 gap-2 overflow-hidden">
        {workers.map(worker => (
          <WorkerSlot key={worker.id} worker={worker} now={now} />
        ))}
      </div>
    </div>
  );
}

function WorkerSlot({ worker, now }: { worker: WorkerState; now: number }) {
  const elapsed = worker.startedAt ? now - worker.startedAt : 0;
  const elapsedSec = (elapsed / 1000).toFixed(1);

  // Estimated progress (workers run 50-200ms normally, 2-5s in demo mode)
  // Show a running bar that bounces rather than a fake percentage
  const progressPct = worker.status === "EXECUTING"
    ? Math.min((elapsed / 5000) * 100, 95) // cap at 95%, never 100% until completion
    : worker.status === "COMPLETED" ? 100 : 0;

  const statusConfig = {
    IDLE: {
      color: "text-muted-foreground/40",
      barColor: "bg-muted/20",
      border: "border-border",
      bg: "bg-[hsl(220,22%,10%)]",
      label: "IDLE",
    },
    EXECUTING: {
      color: "text-blue-400",
      barColor: "bg-blue-500",
      border: "border-blue-500/30",
      bg: "bg-blue-950/20",
      label: "EXECUTING",
    },
    COMPLETED: {
      color: "text-emerald-400",
      barColor: "bg-emerald-500",
      border: "border-emerald-500/30",
      bg: "bg-emerald-950/20",
      label: "DONE",
    },
  }[worker.status];

  return (
    <div className={cn(
      "rounded border flex flex-col justify-between p-2 transition-all duration-300",
      statusConfig.bg, statusConfig.border,
      worker.status === "EXECUTING" && "glow-blue",
      worker.status === "COMPLETED" && "glow-emerald",
    )}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            worker.status === "IDLE" ? "bg-muted-foreground/30" :
            worker.status === "EXECUTING" ? "bg-blue-400 animate-pulse" :
            "bg-emerald-400 animate-pulse"
          )} />
          <span className="text-[10px] font-bold text-muted-foreground">W{worker.id}</span>
        </div>
        <span className={cn("text-[9px] font-bold tracking-wider", statusConfig.color)}>
          {statusConfig.label}
        </span>
      </div>

      {/* Task & elapsed */}
      <div className="flex items-center justify-between">
        <span className={cn("text-[10px] font-mono truncate", worker.currentTask ? "text-foreground" : "text-muted-foreground/30")}>
          {worker.currentTask ?? "---"}
        </span>
        {worker.status === "EXECUTING" && (
          <span className="text-[9px] text-blue-400/70 shrink-0 ml-1">{elapsedSec}s</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-1.5 h-0.5 bg-border rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-200", statusConfig.barColor)}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Completed count */}
      <div className="mt-1 text-[9px] text-muted-foreground/30">
        {worker.completedCount > 0 ? `${worker.completedCount} tasks done` : "awaiting dispatch"}
      </div>
    </div>
  );
}
