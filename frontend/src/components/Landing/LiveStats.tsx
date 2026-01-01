"use client";

import { Activity } from "lucide-react";
import { useState, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { fetchLiveMetrics } from "@/lib/api";

export function LiveStats() {
  const [stats, setStats] = useState({
    runningNodes: 1, // Single-node execution engine
    activeTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
  });

  useWebSocket({
    onMessage: (payload: any) => {
      // payload might have top level type or just be the metrics directly if it's the metrics update.
      // Assuming event structure resembles { type: "metrics.update", payload: { ... } }
      if (payload.type === "metrics.update" && payload.payload) {
        setStats({
          runningNodes: 1,
          activeTasks: payload.payload.queue_size || 0,
          completedTasks: payload.payload.total_completed || 0,
          failedTasks: payload.payload.total_failed || 0,
        });
      }
    }
  });

  useEffect(() => {
    // Fetch initial metrics
    fetchLiveMetrics().then((data) => {
      if (data) {
        setStats({
          runningNodes: 1, // Always 1 for OrionScheduler
          activeTasks: data.queue_size || 0, // Approx for active/pending
          completedTasks: data.total_completed || 0,
          failedTasks: data.total_failed || 0,
        });
      }
    }).catch(console.error);
  }, []);

  return (
    <section className="py-12 border-t border-b bg-muted/10">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity className="w-5 h-5 text-emerald-500" />
          <h2 className="text-2xl font-bold tracking-tight text-center">Cluster Telemetry</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border rounded-lg p-6 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-sm text-muted-foreground font-mono mb-2">RUNNING_NODES</p>
            <p className="text-4xl font-bold text-foreground">{stats.runningNodes}</p>
          </div>
          
          <div className="bg-card border rounded-lg p-6 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-sm text-muted-foreground font-mono mb-2">ACTIVE_TASKS</p>
            <p className="text-4xl font-bold text-blue-500">{stats.activeTasks}</p>
          </div>
          
          <div className="bg-card border rounded-lg p-6 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-sm text-muted-foreground font-mono mb-2">COMPLETED</p>
            <p className="text-4xl font-bold text-emerald-500">{stats.completedTasks}</p>
          </div>
          
          <div className="bg-card border rounded-lg p-6 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-sm text-muted-foreground font-mono mb-2">FAILED</p>
            <p className="text-4xl font-bold text-destructive">{stats.failedTasks}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
