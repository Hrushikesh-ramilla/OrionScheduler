export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying';

export interface Task {
  id: string;
  payload: string;
  priority: number;
  dependencies: string[];
  max_retries?: number;
}

export interface DAGTaskState extends Task {
  status: TaskStatus;
  attempts: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface DAGInfo {
  id: string;
  tasks: Record<string, DAGTaskState>;
  submitted_at: string;
}

export type EventType = 
  | 'task.started' 
  | 'task.completed' 
  | 'task.failed' 
  | 'task.cascade'
  | 'task.retry'
  | 'dag.submitted'
  | 'system.crash' 
  | 'system.recover'
  | 'metrics.update';

export interface TaskEvent {
  type: EventType;
  task_id?: string;
  dag_tasks?: string[];
  worker_id?: number;
  duration_ms?: number;
  retry?: number;
  max_retry?: number;
  metadata?: Record<string, string>;
  timestamp: string;
}
