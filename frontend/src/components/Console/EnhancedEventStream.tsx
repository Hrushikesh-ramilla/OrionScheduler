"use client";

import { useState, useEffect, useRef } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { TaskEvent } from "@/types";
import { cn } from "@/lib/utils";

interface StreamEvent {
  id: string;
  event: TaskEvent;
  annotation: string;
  level: "info" | "warn" | "error" | "critical" | "success" | "system";
}

function getAnnotation(event: TaskEvent): string {
  switch (event.type) {
    case "task.started":
      return event.worker_id
        ? `Backend reported task start on worker ${event.worker_id}.`
        : "Backend reported task start.";
    case "task.completed":
      return `Backend reported task completion. Duration: ${event.duration_ms?.toFixed(1) ?? "?"}ms.`;
    case "task.failed":
      if ((event.retry ?? 0) < (event.max_retry ?? 3)) {
        const delay = Math.min(Math.pow(2, event.retry ?? 1), 30);
        return `Backend reported a retryable failure. Attempt ${event.retry}/${event.max_retry}; next retry is about ${delay}s.`;
      }
      return `Backend reported permanent failure after ${event.retry}/${event.max_retry} retries.`;
    case "task.retry":
      const delay = Math.min(Math.pow(2, event.retry ?? 1), 30);
      return `Backend scheduled a retry. Attempt ${event.retry}/${event.max_retry}; delay is about ${delay}s.`;
    case "task.cascade":
      const affected = event.dag_tasks ?? [];
      return `Backend reported a cascade from ${event.task_id ?? "unknown root"}. Affected tasks: [${affected.join(", ")}].`;
    case "dag.submitted":
      const taskCount = event.dag_tasks?.length ?? 0;
      return `Backend accepted DAG submission with ${taskCount} task(s).`;
    case "system.crash":
      return "Backend reported scheduler crash simulation.";
    case "system.recover":
      const completed = event.metadata?.completed_recovered ?? "?";
      const failed = event.metadata?.failed_recovered ?? "?";
      const orphans = event.metadata?.orphans_requeued ?? "?";
      return `Backend recovery summary: ${completed} completed, ${failed} failed, ${orphans} in-flight task(s) requeued.`;
    case "metrics.update":
      return `Metrics update. Running: ${event.metadata?.running ?? 0}, queue: ${event.metadata?.queue_size ?? 0}, dropped: ${event.metadata?.dropped_events ?? 0}.`;
    default:
      return JSON.stringify(event.metadata ?? {});
  }
}

function getLevel(event: TaskEvent): StreamEvent["level"] {
  switch (event.type) {
    case "task.started": return "info";
    case "task.completed": return "success";
    case "task.failed": return (event.retry ?? 0) >= (event.max_retry ?? 3) ? "error" : "warn";
    case "task.retry": return "warn";
    case "task.cascade": return "critical";
    case "dag.submitted": return "system";
    case "system.crash": return "critical";
    case "system.recover": return "success";
    case "metrics.update": return "info";
    default: return "info";
  }
}

const levelStyles: Record<StreamEvent["level"], string> = {
  info:     "text-blue-400",
  warn:     "text-amber-400",
  error:    "text-red-400",
  critical: "text-red-500 font-bold",
  success:  "text-emerald-400",
  system:   "text-violet-400",
};

const eventTypeLabel: Record<string, string> = {
  "task.started":   "TASK_START  ",
  "task.completed": "TASK_DONE   ",
  "task.failed":    "TASK_FAIL   ",
  "task.retry":     "TASK_RETRY  ",
  "task.cascade":   "CASCADE_BFS ",
  "dag.submitted":  "DAG_INGEST  ",
  "system.crash":   "SYS_CRASH   ",
  "system.recover": "SYS_RECOVER ",
  "metrics.update": "METRICS_TICK",
};

interface EnhancedEventStreamProps {
  filter?: string[];
  showMetricsTicks?: boolean;
}

export function EnhancedEventStream({ filter, showMetricsTicks = false }: EnhancedEventStreamProps) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const idCounter = useRef(0);

  const { status } = useWebSocket({
    onMessage: (event: TaskEvent) => {
      if (!showMetricsTicks && event.type === "metrics.update") return;
      if (filter && !filter.includes(event.type)) return;

      const streamEvent: StreamEvent = {
        id: `${++idCounter.current}`,
        event,
        annotation: getAnnotation(event),
        level: getLevel(event),
      };
      setEvents(prev => {
        const next = [...prev, streamEvent];
        return next.length > 500 ? next.slice(-500) : next;
      });
    }
  });

  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [events]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  };

  return (
    <div className="flex flex-col h-full bg-[hsl(220,25%,5%)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-[hsl(220,22%,8%)] shrink-0">
        <span className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground">EVENT STREAM</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className={cn("w-1.5 h-1.5 rounded-full", status === "connected" ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
          <span className="text-[9px] text-muted-foreground">{events.length} events</span>
          {events.length > 0 && (
            <button
              onClick={() => setEvents([])}
              className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground ml-2"
            >CLR</button>
          )}
        </span>
      </div>

      {/* Stream */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2 space-y-0.5"
      >
        {events.length === 0 ? (
          <div className="text-muted-foreground/30 text-[10px] pt-4 text-center">
            Awaiting system events...
          </div>
        ) : (
          events.map((se) => (
            <EventRow key={se.id} se={se} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function EventRow({ se }: { se: StreamEvent }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(se.event.timestamp).toLocaleTimeString([], {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
    fractionalSecondDigits: 3,
  });

  return (
    <div
      className={cn(
        "group cursor-pointer rounded-sm px-1 py-0.5 transition-colors hover:bg-white/5",
        se.level === "critical" && "bg-red-950/20",
        se.level === "system" && "bg-violet-950/10",
      )}
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex items-start gap-2 text-[10px] font-mono leading-tight">
        <span className="text-muted-foreground/40 shrink-0 tabular-nums">{time}</span>
        <span className={cn("shrink-0 tracking-wider", levelStyles[se.level])}>
          {eventTypeLabel[se.event.type] ?? se.event.type.padEnd(12)}
        </span>
        {se.event.task_id && (
          <span className="text-foreground/70 shrink-0">
            {se.event.task_id}
          </span>
        )}
        {se.event.worker_id ? (
          <span className="text-violet-400/70 shrink-0">W{se.event.worker_id}</span>
        ) : null}
        {se.event.duration_ms ? (
          <span className="text-muted-foreground/50 shrink-0">{se.event.duration_ms.toFixed(0)}ms</span>
        ) : null}
        {se.event.retry != null && se.event.max_retry != null ? (
          <span className="text-amber-400/70 shrink-0">retry:{se.event.retry}/{se.event.max_retry}</span>
        ) : null}
      </div>
      {/* Annotation */}
      <div className={cn(
        "text-[9px] text-muted-foreground/50 mt-0.5 pl-[88px] leading-tight",
        expanded ? "block" : "hidden group-hover:block",
      )}>
        {se.annotation}
      </div>
    </div>
  );
}
