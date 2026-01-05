"use client";

import { Activity, Server, CheckCircle2, Clock, AlertCircle, Database } from "lucide-react";
import { useEffect, useState } from "react";
import { MetricCard } from "@/components/Metrics/MetricCard";
import { ThroughputChart } from "@/components/Metrics/ThroughputChart";
import { LatencyChart } from "@/components/Metrics/LatencyChart";
import { useMetricsState, TimeSeriesPoint } from "@/hooks/useMetricsState";
import { useWebSocket } from "@/hooks/useWebSocket";
import { fetchLiveMetrics, fetchDags } from "@/lib/api";

interface DAGInfo {
  id: string;
  task_ids: string[];
  task_count: number;
  submitted_at: string;
}

export default function MetricsPage() {
  const { summary, setSummary, timeSeries, addDataPoint } = useMetricsState();
  const [dags, setDags] = useState<DAGInfo[]>([]);

  // Wire the metrics.update WebSocket event to charts.
  // Backend emits: { type: "metrics.update", metadata: { pending, running, completed, ... } }
  // Field names mirror the backend Metadata map keys exactly.
  useWebSocket({
    onMessage: (data: any) => {
      if (data.type === "metrics.update" && data.metadata) {
        const meta = data.metadata;
        const timestamp = new Date().toLocaleTimeString([], {
          hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
        });

        setSummary({
          runningNodes: 1,
          activeTasks:    parseInt(meta.running   ?? "0", 10),
          completedTasks: parseInt(meta.completed ?? "0", 10),
          failedTasks:    parseInt(meta.failed    ?? "0", 10),
          uptimeSeconds:  0, // uptime comes from /api/v1/metrics/live on mount
        });

        // Use running+completed as a throughput proxy since the backend does not
        // separately compute tasks_per_sec in the ticker.
        addDataPoint({
          timestamp,
          tasksPerSec:  parseInt(meta.running ?? "0", 10),
          avgLatencyMs: 0, // backend does not emit per-tick latency; histogram is in Prometheus
        });
      }
    }
  });

  // Fetch REST snapshot on mount for initial card values.
  useEffect(() => {
    fetchLiveMetrics().then((data) => {
      if (data) {
        setSummary({
          runningNodes:   1,
          activeTasks:    data.running    ?? 0,
          completedTasks: data.completed  ?? 0,
          failedTasks:    data.failed     ?? 0,
          uptimeSeconds:  data.uptime_seconds ?? 0,
        });

        const timestamp = new Date().toLocaleTimeString([], {
          hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        addDataPoint({
          timestamp,
          tasksPerSec:  data.running ?? 0,
          avgLatencyMs: 0,
        });
      }
    }).catch(console.error);

    // MINOR 1: Fetch DAG history list and display in the table below charts.
    fetchDags().then((data) => {
      if (data?.dags) {
        setDags(data.dags);
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
        {/* Metric Cards */}
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ThroughputChart data={timeSeries} />
          <LatencyChart data={timeSeries} />
        </div>

        {/* DAG History — MINOR 1: wires fetchDags to useful UI */}
        <div className="bg-card border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            DAG Submission History
          </h3>
          {dags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No DAGs submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">DAG ID</th>
                    <th className="text-left py-2 pr-4 font-medium">Task Count</th>
                    <th className="text-left py-2 pr-4 font-medium">Task IDs</th>
                    <th className="text-left py-2 font-medium">Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {dags
                    .slice()
                    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
                    .map((dag) => (
                      <tr key={dag.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2 pr-4 font-mono text-xs text-primary">{dag.id}</td>
                        <td className="py-2 pr-4">{dag.task_count}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground truncate max-w-[300px]">
                          {dag.task_ids?.join(', ') ?? '—'}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(dag.submitted_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
