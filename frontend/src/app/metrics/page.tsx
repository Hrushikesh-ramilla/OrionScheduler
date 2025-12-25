"use client";

import { Activity, Server, CheckCircle2, Clock } from "lucide-react";
import { useEffect } from "react";
import { MetricCard } from "@/components/Metrics/MetricCard";
import { ThroughputChart } from "@/components/Metrics/ThroughputChart";
import { LatencyChart } from "@/components/Metrics/LatencyChart";
import { useMetricsState, TimeSeriesPoint } from "@/hooks/useMetricsState";
import { useWebSocket } from "@/hooks/useWebSocket";
import { fetchLiveMetrics } from "@/lib/api";

export default function MetricsPage() {
  const { summary, setSummary, timeSeries, addDataPoint } = useMetricsState();

  useWebSocket({
    onMessage: (data: any) => {
      if (data.type === "metrics.update" && data.payload) {
        const payload = data.payload;
        
        const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setSummary({
          runningNodes: 1,
          activeTasks: payload.queue_size || 0,
          completedTasks: payload.total_completed || 0,
          failedTasks: payload.total_failed || 0,
          uptimeSeconds: Math.floor((payload.uptime_ms || 0) / 1000),
        });

        addDataPoint({
          timestamp,
          tasksPerSec: payload.tasks_per_sec || 0,
          avgLatencyMs: payload.avg_latency_ms || 0
        });
      }
    }
  });

  useEffect(() => {
    fetchLiveMetrics().then((data) => {
      if (data) {
        setSummary({
          runningNodes: 1,
          activeTasks: data.queue_size || 0,
          completedTasks: data.total_completed || 0,
          failedTasks: data.total_failed || 0,
          uptimeSeconds: Math.floor((data.uptime_ms || 0) / 1000),
        });
        
        // Push an initial data point
        const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        addDataPoint({
          timestamp,
          tasksPerSec: data.tasks_per_sec || 0,
          avgLatencyMs: data.avg_latency_ms || 0
        });
      }
    }).catch(console.error);
  }, [setSummary, addDataPoint]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
            <Activity className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            System Metrics
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">Real-time observability and throughput monitoring.</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 bg-card border px-3 md:px-4 py-1.5 md:py-2 rounded-full shadow-sm">
          <div className="relative flex items-center justify-center">
            <span className={`absolute inline-flex w-2.5 h-2.5 md:w-3 md:h-3 rounded-full opacity-75 animate-ping ${summary.runningNodes > 0 ? 'bg-emerald-500' : 'bg-destructive'}`}></span>
            <span className={`relative inline-flex rounded-full w-2 h-2 ${summary.runningNodes > 0 ? 'bg-emerald-500' : 'bg-destructive'}`}></span>
          </div>
          <span className="text-xs md:text-sm font-medium">Cluster <span className="hidden sm:inline">{summary.runningNodes > 0 ? 'Healthy' : 'Offline'}</span></span>
        </div>
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* Metric Cards Grid - Commit 66 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
