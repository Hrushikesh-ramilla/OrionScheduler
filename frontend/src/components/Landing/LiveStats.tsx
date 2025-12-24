"use client";

import { Activity } from "lucide-react";

export function LiveStats() {
  // Hardcoded values for UI development (Commit 60)
  const stats = {
    runningNodes: 1,
    activeTasks: 42,
    completedTasks: 1337,
    failedTasks: 0,
  };

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
