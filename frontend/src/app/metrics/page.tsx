"use client";

import { Activity, Server, CheckCircle2, Clock } from "lucide-react";
import { MetricCard } from "@/components/Metrics/MetricCard";

export default function MetricsPage() {
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
      </div>

      <div className="space-y-8">
        {/* Metric Cards Grid - Commit 66 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="Running Nodes" 
            value={1} 
            icon={<Server className="w-5 h-5" />} 
          />
          <MetricCard 
            title="Active Tasks" 
            value={0} 
            icon={<Activity className="w-5 h-5 text-blue-500" />} 
          />
          <MetricCard 
            title="Completed Tasks" 
            value={0} 
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} 
          />
          <MetricCard 
            title="Cluster Uptime" 
            value="0s" 
            icon={<Clock className="w-5 h-5 text-blue-500" />} 
          />
        </div>

        {/* Charts Grid - Commit 67 & 68 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card p-6 border rounded-lg h-80 flex items-center justify-center text-muted-foreground text-sm">
            [Throughput Chart Placeholder]
          </div>
          <div className="bg-card p-6 border rounded-lg h-80 flex items-center justify-center text-muted-foreground text-sm">
            [Latency Chart Placeholder]
          </div>
        </div>
      </div>
    </div>
  );
}
