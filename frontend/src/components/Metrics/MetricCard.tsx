import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export function MetricCard({ title, value, icon, trend, className }: MetricCardProps) {
  return (
    <div className={cn("bg-card p-6 border rounded-lg flex flex-col justify-between shadow-sm", className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="text-3xl font-bold text-foreground">
        {value}
      </div>
      {trend && (
        <div className="mt-2 text-xs flex items-center">
          <span className={cn("font-medium", trend.value > 0 ? "text-emerald-500" : trend.value < 0 ? "text-destructive" : "text-muted-foreground")}>
            {trend.value > 0 ? "+" : ""}{trend.value}%
          </span>
          <span className="text-muted-foreground ml-1">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
