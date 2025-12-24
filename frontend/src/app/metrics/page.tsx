"use client";

import { Activity } from "lucide-react";

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
          <div className="bg-card p-6 border rounded-lg h-32 flex items-center justify-center text-muted-foreground text-sm">
            [Metric Card Placeholder]
          </div>
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
