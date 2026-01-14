import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TimeSeriesPoint } from "@/hooks/useMetricsState";

interface LatencyChartProps {
  data: TimeSeriesPoint[];
}

export function LatencyChart({ data }: LatencyChartProps) {
  return (
    <div className="bg-card border rounded-lg p-6 shadow-sm h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-4">Average Latency (ms)</h3>
      <div className="flex-1 min-h-[250px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                itemStyle={{ color: "hsl(var(--emerald))" }}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
              />
              <Bar 
                dataKey="avgLatencyMs" 
                fill="hsl(var(--emerald))" 
                radius={[4, 4, 0, 0]} 
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            Waiting for data...
          </div>
        )}
      </div>
    </div>
  );
}
