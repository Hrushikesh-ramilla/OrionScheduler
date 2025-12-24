import { useState, useCallback } from "react";

export interface TimeSeriesPoint {
  timestamp: string;
  tasksPerSec: number;
  avgLatencyMs: number;
}

export interface MetricSummary {
  runningNodes: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  uptimeSeconds: number;
}

export function useMetricsState(maxPoints = 40) {
  const [summary, setSummary] = useState<MetricSummary>({
    runningNodes: 1,
    activeTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    uptimeSeconds: 0,
  });

  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);

  const addDataPoint = useCallback((point: TimeSeriesPoint) => {
    setTimeSeries(prev => {
      const updated = [...prev, point];
      if (updated.length > maxPoints) {
        return updated.slice(updated.length - maxPoints);
      }
      return updated;
    });
  }, [maxPoints]);

  return {
    summary,
    setSummary,
    timeSeries,
    setTimeSeries,
    addDataPoint,
  };
}
