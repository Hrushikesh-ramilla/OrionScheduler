"use client";

import { Activity, Server, CheckCircle2, Clock } from "lucide-react";
import { MetricCard } from "@/components/Metrics/MetricCard";
import { ThroughputChart } from "@/components/Metrics/ThroughputChart";
import { LatencyChart } from "@/components/Metrics/LatencyChart";
import { useMetricsState } from "@/hooks/useMetricsState";

export default function MetricsPage() {
  const { summary, timeSeries } = useMetricsState();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
            <Activity className="w-8 h-8 text-primary" />
            System Metrics
          </h1>
          <p className="text-muted-foreground">Real-time observability and throughput monitoring.</p>
        </div>
        <div className="flex items-center gap-3 bg-card border px-4 py-2 rounded-full shadow-sm">
          <div className="relative flex items-center justify-center">
            <span className={`absolute inline-flex w-3 h-3 rounded-full opacity-75 animate-ping ${summary.runningNodes > 0 ? 'bg-emerald-500' : 'bg-destructive'}`}></span>
            <span className={`relative inline-flex rounded-full w-2 h-2 ${summary.runningNodes > 0 ? 'bg-emerald-500' : 'bg-destructive'}`}></span>
          </div>
          <span className="text-sm font-medium">Cluster {summary.runningNodes > 0 ? 'Healthy' : 'Offline'}</span>
        </div>
      </div>

      <div className="space-y-8">
        {/* Metric Cards Grid - Commit 66 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="Running Nodes" 
            value={summary.runningNodes} 
            icon={<Server className="w-5 h-5" />} 
          />
          <MetricCard 
            title="Active Tasks" 
            value={summary.activeTasks} 
            icon={<Activity className="w-5 h-5 text-blue-500" />} 
          />
          <MetricCard 
            title="Completed Tasks" 
            value={summary.completedTasks} 
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} 
          />
          <MetricCard 
            title="Cluster Uptime" 
            value={`${summary.uptimeSeconds}s`} 
            icon={<Clock className="w-5 h-5 text-blue-500" />} 
          />
        </div>

        {/* Charts Grid - Commit 67 & 68 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ThroughputChart data={timeSeries} />
          <LatencyChart data={timeSeries} />
        </div>
      </div>
    </div>
  );
}
