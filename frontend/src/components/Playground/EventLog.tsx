"use client";

import { useState, useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { TaskEvent } from "@/types";
import { cn } from "@/lib/utils";

export function EventLog() {
  const [logs, setLogs] = useState<TaskEvent[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { status } = useWebSocket({
    onMessage: (event: TaskEvent) => {
      setLogs((prev) => [...prev, event]);
    }
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const formatEvent = (event: TaskEvent) => {
    const time = new Date(event.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 });
    
    let color = "text-muted-foreground";
    if (event.type === "system.crash") color = "text-destructive font-bold";
    if (event.type === "system.recover") color = "text-emerald-500 font-bold";
    if (event.type.includes("failed")) color = "text-destructive";
    if (event.type.includes("completed")) color = "text-emerald-500";
    if (event.type.includes("started")) color = "text-blue-500";
    
    return (
      <div key={`${event.task_id}-${event.timestamp}-${Math.random()}`} className="font-mono text-xs leading-relaxed">
        <span className="text-muted-foreground/50">[{time}]</span>{" "}
        <span className={color}>
          {event.type.padEnd(16, " ")}
        </span>{" "}
        {event.task_id ? <span className="text-foreground/80">TID:{event.task_id}</span> : null}
        {event.worker_id ? <span className="text-muted-foreground ml-2">W:{event.worker_id}</span> : null}
        {event.duration_ms ? <span className="text-muted-foreground ml-2">{event.duration_ms.toFixed(0)}ms</span> : null}
      </div>
    );
  };

  return (
    <div className="w-full h-64 border-t bg-[#0D0D0D] flex flex-col font-mono relative">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-card/50 text-xs text-muted-foreground">
        <Terminal className="w-4 h-4" />
        System Event Log
        <div className="ml-auto flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", status === 'connected' ? "bg-emerald-500" : "bg-destructive")} />
          WS: {status}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {logs.length === 0 ? (
          <div className="text-muted-foreground/50 text-xs">Waiting for system events...</div>
        ) : (
          logs.slice(-100).map(formatEvent)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
