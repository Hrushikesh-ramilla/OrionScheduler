package models

import "time"

// TaskEvent represents a state-change event emitted by the scheduler.
// These events are broadcast to WebSocket clients for real-time UI updates.
type TaskEvent struct {
	Type      string            `json:"type"`
	TaskID    string            `json:"task_id,omitempty"`
	DAGTasks  []string          `json:"dag_tasks,omitempty"`
	WorkerID  int               `json:"worker_id,omitempty"`
	Duration  float64           `json:"duration_ms,omitempty"`
	Retry     int               `json:"retry,omitempty"`
	MaxRetry  int               `json:"max_retry,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
	Timestamp time.Time         `json:"timestamp"`
}

// Event type constants.
const (
	EventTaskStarted   = "task.started"
	EventTaskCompleted = "task.completed"
	EventTaskFailed    = "task.failed"
	EventTaskCascade   = "task.cascade"
	EventTaskRetry     = "task.retry"
	EventDAGSubmitted  = "dag.submitted"
	EventSystemCrash   = "system.crash"
	EventSystemRecover = "system.recover"
	EventMetricsUpdate = "metrics.update"
)
