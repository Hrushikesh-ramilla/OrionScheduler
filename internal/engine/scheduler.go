package engine

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"sync/atomic"
	"time"

	"go-enterprise-scheduler/internal/storage"
	"go-enterprise-scheduler/pkg/models"
	"go-enterprise-scheduler/pkg/telemetry"
)

// Atomic metrics — updated inside runLoop, read lock-free from any goroutine.
type atomicMetrics struct {
	pending   atomic.Int64
	running   atomic.Int64
	completed atomic.Int64
	failed    atomic.Int64
	retried   atomic.Int64
}

type ingestReq struct {
	tasks []models.Task
	resp  chan error
}

// walReplayFailReq carries the information needed to replay a WAL FAIL record.
// isCascade distinguishes cascade-propagated failures from organic worker failures.
type walReplayFailReq struct {
	taskID    string
	isCascade bool
}

// TaskInfo is a serializable snapshot of a task's state, safe to copy across
// goroutine boundaries. It omits the atomic.Int32 Cancelled field which is only
// needed by the scheduler's internal concurrency guards.
type TaskInfo struct {
	ID           string    `json:"id"`
	Payload      string    `json:"payload"`
	Priority     int       `json:"priority"`
	Dependencies []string  `json:"dependencies"`
	Status       string    `json:"status"`
	RetryCount   int       `json:"retry_count"`
	MaxRetries   int       `json:"max_retries"`
	StartTime    time.Time `json:"start_time,omitempty"`
	EndTime      time.Time `json:"end_time,omitempty"`
}

type Scheduler struct {
	tasks      map[string]*models.Task
	inDegree   map[string]int
	dependents map[string][]string
	readyQueue *PriorityQueue
	wal        *storage.WAL
	metrics    atomicMetrics

	ingestChan   chan ingestReq
	completeChan chan string
	failChan     chan string
	popReqChan   chan chan *models.Task
	retryChan    chan string

	replayStartChan    chan string
	replayCompleteChan chan string
	replayFailChan     chan walReplayFailReq
	requeueOrphansChan chan struct {
		orphans map[string]bool
		done    chan struct{}
	}

	readyChan chan *models.Task
	queueSize atomic.Int64

	// EventChan receives task lifecycle events for external consumers (WebSocket hub).
	// Buffered 1000-deep and sent non-blocking so the event loop is never stalled.
	// Drops are counted via droppedEvents.
	EventChan chan models.TaskEvent

	// droppedEvents counts events silently dropped when EventChan buffer is full.
	// Exposed via DroppedEvents() and reported in /api/v1/metrics/live.
	droppedEvents atomic.Int64

	// getStateChan is used by GetTaskSnapshot to safely read task state from
	// within the single-threaded runLoop without a data race.
	getStateChan chan chan map[string]TaskInfo
}

func NewScheduler(wal *storage.WAL) *Scheduler {
	return &Scheduler{
		tasks:              make(map[string]*models.Task),
		inDegree:           make(map[string]int),
		dependents:         make(map[string][]string),
		readyQueue:         NewPriorityQueue(),
		wal:                wal,
		ingestChan:         make(chan ingestReq),
		completeChan:       make(chan string),
		failChan:           make(chan string),
		popReqChan:         make(chan chan *models.Task),
		retryChan:          make(chan string),
		replayStartChan:    make(chan string),
		replayCompleteChan: make(chan string),
		replayFailChan:     make(chan walReplayFailReq),
		requeueOrphansChan: make(chan struct {
			orphans map[string]bool
			done    chan struct{}
		}),
		readyChan:    make(chan *models.Task),
		EventChan:    make(chan models.TaskEvent, 1000), // 1000-deep; drops are counted.
		getStateChan: make(chan chan map[string]TaskInfo),
	}
}

// emitEvent sends a task event to external consumers without ever blocking
// the scheduler event loop. If the channel buffer is full, the event is dropped
// and the droppedEvents counter is incremented so the drop is observable.
func (s *Scheduler) emitEvent(event models.TaskEvent) {
	select {
	case s.EventChan <- event:
	default:
		s.droppedEvents.Add(1)
	}
}

// DroppedEvents returns the cumulative count of events dropped due to
// EventChan buffer saturation. An increasing counter indicates slow
// WebSocket consumers or an undersized buffer.
func (s *Scheduler) DroppedEvents() int64 {
	return s.droppedEvents.Load()
}

func (s *Scheduler) Start(ctx context.Context) {
	go s.runLoop(ctx)
	// Emit metrics snapshots every second so the frontend charts stay live.
	// This goroutine exits when the scheduler context is cancelled (SimulateCrash),
	// so charts stop updating after crash and resume after recovery.
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				pending, running, completed, failed, retried := s.Metrics()
				s.emitEvent(models.TaskEvent{
					Type:      models.EventMetricsUpdate,
					Timestamp: time.Now(),
					Metadata: map[string]string{
						"pending":        fmt.Sprintf("%d", pending),
						"running":        fmt.Sprintf("%d", running),
						"completed":      fmt.Sprintf("%d", completed),
						"failed":         fmt.Sprintf("%d", failed),
						"retried":        fmt.Sprintf("%d", retried),
						"queue_size":     fmt.Sprintf("%d", s.QueueSize()),
						"dropped_events": fmt.Sprintf("%d", s.DroppedEvents()),
					},
				})
			case <-ctx.Done():
				return
			}
		}
	}()
}

func (s *Scheduler) StartDispatch(ctx context.Context) {
	go s.pushLoop(ctx)
}

func (s *Scheduler) ReadyTasks() <-chan *models.Task {
	return s.readyChan
}

func (s *Scheduler) runLoop(ctx context.Context) {
	for {
		var activePopReq chan chan *models.Task
		if s.readyQueue.Len() > 0 {
			activePopReq = s.popReqChan
		}

		select {
		case req := <-activePopReq:
			var task *models.Task
			for s.readyQueue.Len() > 0 {
				t := s.readyQueue.Dequeue()
				s.queueSize.Add(-1)
				telemetry.CurrentQueueSize.Dec()
				if t.Status == models.StatusReady {
					task = t
					break
				}
			}
			if task != nil {
				s.metrics.pending.Add(-1)
				s.metrics.running.Add(1)
				task.Status = models.StatusRunning
			}
			req <- task

		case req := <-s.ingestChan:
			s.handleIngest(req)

		case taskID := <-s.completeChan:
			s.handleComplete(taskID)

		case taskID := <-s.failChan:
			s.handleFailure(taskID)

		case taskID := <-s.replayStartChan:
			s.handleReplayStart(taskID)

		case taskID := <-s.replayCompleteChan:
			s.handleReplayComplete(taskID)

		case req := <-s.replayFailChan:
			s.handleReplayFail(req)

		case req := <-s.requeueOrphansChan:
			s.handleRequeueOrphans(req.orphans)
			close(req.done)

		case taskID := <-s.retryChan:
			s.handleRetryEnqueue(taskID)

		case replyCh := <-s.getStateChan:
			// Safe snapshot: we are inside runLoop so no other goroutine
			// mutates s.tasks concurrently. TaskInfo excludes atomic fields.
			snap := make(map[string]TaskInfo, len(s.tasks))
			for id, t := range s.tasks {
				snap[id] = TaskInfo{
					ID:           t.ID,
					Payload:      t.Payload,
					Priority:     t.Priority,
					Dependencies: t.Dependencies,
					Status:       t.Status,
					RetryCount:   t.RetryCount,
					MaxRetries:   t.MaxRetries,
					StartTime:    t.StartTime,
					EndTime:      t.EndTime,
				}
			}
			replyCh <- snap

		case <-ctx.Done():
			return
		}
	}
}

func (s *Scheduler) handleIngest(req ingestReq) {
	log.Println("SCHED: ingest")
	for i := range req.tasks {
		t := &req.tasks[i]
		if _, exists := s.tasks[t.ID]; exists {
			req.resp <- fmt.Errorf("scheduler: duplicate task ID %q", t.ID)
			return
		}
	}

	taskIDs := make([]string, 0, len(req.tasks))
	for i := range req.tasks {
		t := &req.tasks[i]
		t.Status = models.StatusPending
		s.metrics.pending.Add(1)
		if t.MaxRetries == 0 {
			t.MaxRetries = 3 // sensible default
		}
		s.tasks[t.ID] = t
		s.inDegree[t.ID] = len(t.Dependencies)
		taskIDs = append(taskIDs, t.ID)

		for _, depID := range t.Dependencies {
			s.dependents[depID] = append(s.dependents[depID], t.ID)
		}
	}

	telemetry.TasksIngestedTotal.Add(float64(len(req.tasks)))

	s.emitEvent(models.TaskEvent{
		Type:      models.EventDAGSubmitted,
		DAGTasks:  taskIDs,
		Timestamp: time.Now(),
	})

	for i := range req.tasks {
		t := &req.tasks[i]
		if s.inDegree[t.ID] == 0 {
			t.Status = models.StatusReady
			// pending→ready is still "pending" in metrics (both count as pending)
			s.readyQueue.Enqueue(t)
			s.queueSize.Add(1)
			telemetry.CurrentQueueSize.Inc()
			log.Println("SCHED: task ready")
			slog.Info("task ready", "task_id", t.ID, "reason", "no_dependencies")
		}
	}
	req.resp <- nil
}

func (s *Scheduler) handleComplete(taskID string) {
	log.Println("SCHED: complete")
	task, exists := s.tasks[taskID]
	if !exists {
		slog.Warn("attempted to complete unknown task", "task_id", taskID)
		return
	}

	duration := float64(0)
	if !task.EndTime.IsZero() && !task.StartTime.IsZero() {
		duration = task.EndTime.Sub(task.StartTime).Seconds() * 1000
	}

	s.metrics.running.Add(-1)
	s.metrics.completed.Add(1)
	task.Status = models.StatusCompleted
	telemetry.TasksCompletedTotal.Inc()
	slog.Info("task completed", "task_id", taskID)

	s.emitEvent(models.TaskEvent{
		Type:      models.EventTaskCompleted,
		TaskID:    taskID,
		Duration:  duration,
		Timestamp: time.Now(),
	})

	for _, depID := range s.dependents[taskID] {
		s.inDegree[depID]--
		if s.inDegree[depID] == 0 {
			depTask := s.tasks[depID]
			depTask.Status = models.StatusReady
			s.readyQueue.Enqueue(depTask)
			s.queueSize.Add(1)
			telemetry.CurrentQueueSize.Inc()
			log.Println("SCHED: task ready")
			slog.Info("task ready", "task_id", depID, "reason", "deps_satisfied")
		}
	}
}

func (s *Scheduler) handleFailure(taskID string) {
	task, exists := s.tasks[taskID]
	if !exists {
		return
	}

	if task.RetryCount < task.MaxRetries {
		task.RetryCount++
		telemetry.TasksRetriedTotal.Inc()
		delay := time.Duration(1<<task.RetryCount) * time.Second
		if delay > 30*time.Second {
			delay = 30 * time.Second
		}
		slog.Warn("task failed, retrying", "task_id", taskID, "delay", delay.String(), "attempt", task.RetryCount, "max_retries", task.MaxRetries)

		s.metrics.running.Add(-1)
		s.metrics.pending.Add(1)
		s.metrics.retried.Add(1)
		task.Status = models.StatusPending

		s.emitEvent(models.TaskEvent{
			Type:      models.EventTaskRetry,
			TaskID:    taskID,
			Retry:     task.RetryCount,
			MaxRetry:  task.MaxRetries,
			Timestamp: time.Now(),
		})

		time.AfterFunc(delay, func() {
			s.retryChan <- taskID
		})
	} else {
		s.emitEvent(models.TaskEvent{
			Type:      models.EventTaskFailed,
			TaskID:    taskID,
			Retry:     task.RetryCount,
			MaxRetry:  task.MaxRetries,
			Timestamp: time.Now(),
		})

		// Permanent failure — cascade to all downstream dependents.
		s.propagateFailure(taskID)
	}
}

// propagateFailure marks a task and all its transitive dependents as failed
// using BFS. A visited set prevents infinite loops and re-processing.
func (s *Scheduler) propagateFailure(rootID string) {
	queue := []string{rootID}
	visited := make(map[string]bool)
	cascadeAffected := []string{}

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		if visited[current] {
			continue
		}
		visited[current] = true

		task, exists := s.tasks[current]
		if !exists {
			continue
		}
		if task.Status == models.StatusCompleted || task.Status == models.StatusFailed {
			continue
		}

		// Transition from whatever state to failed.
		switch task.Status {
		case models.StatusPending, models.StatusReady:
			s.metrics.pending.Add(-1)
		case models.StatusRunning:
			s.metrics.running.Add(-1)
		}
		s.metrics.failed.Add(1)
		task.Status = models.StatusFailed
		task.Cancelled.Store(1) // Atomic signal for workers
		telemetry.TasksFailedTotal.Inc()
		// Use AppendCascadeFail so that WAL replay knows this task was killed
		// by cascade propagation and must NOT be re-enqueued or have its retry
		// counter incremented. The root failure is written by the worker itself
		// via AppendFail before calling scheduler.Fail.
		if err := s.wal.AppendCascadeFail(current); err != nil {
			slog.Error("failed to persist cascade failure to WAL", "task_id", current, "error", err)
		}
		slog.Error("task failed permanently", "task_id", current)
		cascadeAffected = append(cascadeAffected, current)

		// Enqueue all direct dependents for cascading failure.
		for _, depID := range s.dependents[current] {
			if !visited[depID] {
				queue = append(queue, depID)
			}
		}
	}

	if len(cascadeAffected) > 0 {
		s.emitEvent(models.TaskEvent{
			Type:      models.EventTaskCascade,
			TaskID:    rootID,
			DAGTasks:  cascadeAffected,
			Timestamp: time.Now(),
		})
	}
}

func (s *Scheduler) handleRetryEnqueue(taskID string) {
	task, exists := s.tasks[taskID]
	if !exists {
		return
	}
	if task.Status == models.StatusPending {
		task.Status = models.StatusReady
		s.readyQueue.Enqueue(task)
		s.queueSize.Add(1)
		telemetry.CurrentQueueSize.Inc()
		slog.Info("task ready for retry", "task_id", taskID)
	}
}

// Metrics reads atomic counters — zero blocking, safe from any goroutine.
func (s *Scheduler) Metrics() (pending, running, completed, failed, retried int) {
	return int(s.metrics.pending.Load()),
		int(s.metrics.running.Load()),
		int(s.metrics.completed.Load()),
		int(s.metrics.failed.Load()),
		int(s.metrics.retried.Load())
}

func (s *Scheduler) pushLoop(ctx context.Context) {
	defer close(s.readyChan)
	for {
		req := make(chan *models.Task, 1)
		select {
		case s.popReqChan <- req:
		case <-ctx.Done():
			return
		}

		select {
		case task := <-req:
			if task != nil {
				select {
				case s.readyChan <- task:
				case <-ctx.Done():
					return
				}
			}
		case <-ctx.Done():
			return
		}
	}
}

func (s *Scheduler) Ingest(tasks []models.Task) error {
	req := ingestReq{
		tasks: tasks,
		resp:  make(chan error, 1),
	}
	s.ingestChan <- req
	return <-req.resp
}

func (s *Scheduler) Complete(taskID string) {
	s.completeChan <- taskID
}

func (s *Scheduler) ReplayStart(taskID string) {
	s.replayStartChan <- taskID
}

func (s *Scheduler) handleReplayStart(taskID string) {
	task, exists := s.tasks[taskID]
	if !exists {
		return
	}
	s.metrics.pending.Add(-1)
	s.metrics.running.Add(1)
	task.Status = models.StatusRunning
}

func (s *Scheduler) RequeueOrphans(inProgress map[string]bool) {
	req := make(chan struct{})
	payload := struct {
		orphans map[string]bool
		done    chan struct{}
	}{inProgress, req}
	s.requeueOrphansChan <- payload
	<-req
}

func (s *Scheduler) handleRequeueOrphans(orphans map[string]bool) {
	for taskID := range orphans {
		if task, exists := s.tasks[taskID]; exists {
			// Orphans were running at crash time; metrics already show
			// them as running from handleReplayStart, move to pending.
			s.metrics.running.Add(-1)
			s.metrics.pending.Add(1)
			task.Status = models.StatusReady
			s.readyQueue.Enqueue(task)
			s.queueSize.Add(1)
			telemetry.CurrentQueueSize.Inc()
			slog.Info("requeued orphan task", "task_id", taskID)
		}
	}
}

func (s *Scheduler) ReplayComplete(taskID string) {
	s.replayCompleteChan <- taskID
}

func (s *Scheduler) handleReplayComplete(taskID string) {
	task, exists := s.tasks[taskID]
	if !exists {
		return
	}
	s.metrics.running.Add(-1)
	s.metrics.completed.Add(1)
	task.Status = models.StatusCompleted

	for _, depID := range s.dependents[taskID] {
		s.inDegree[depID]--
		if s.inDegree[depID] == 0 {
			depTask := s.tasks[depID]
			depTask.Status = models.StatusReady
			s.readyQueue.Enqueue(depTask)
			s.queueSize.Add(1)
			telemetry.CurrentQueueSize.Inc()
		}
	}
}

func (s *Scheduler) Fail(taskID string) {
	s.failChan <- taskID
}

// ReplayFail replays a WAL FAIL record. isCascade must be true when the WAL
// entry was written by propagateFailure (AppendCascadeFail), and false when
// written by a worker (AppendFail). The distinction drives different replay logic.
func (s *Scheduler) ReplayFail(taskID string, isCascade bool) {
	s.replayFailChan <- walReplayFailReq{taskID: taskID, isCascade: isCascade}
}

func (s *Scheduler) handleReplayFail(req walReplayFailReq) {
	task, exists := s.tasks[req.taskID]
	if !exists {
		return
	}

	if req.isCascade {
		// Cascade-killed tasks were never running — do NOT adjust the running
		// counter, do NOT increment RetryCount, do NOT re-enqueue. They must
		// remain permanently failed exactly as they were at crash time.
		s.metrics.failed.Add(1)
		task.Status = models.StatusFailed
		task.Cancelled.Store(1)
		return
	}

	// Organic failure: apply normal retry logic.
	task.RetryCount++
	if task.RetryCount >= task.MaxRetries {
		s.metrics.running.Add(-1)
		s.metrics.failed.Add(1)
		task.Status = models.StatusFailed
	} else {
		s.metrics.running.Add(-1)
		s.metrics.pending.Add(1)
		s.metrics.retried.Add(1)
		task.Status = models.StatusReady
		s.readyQueue.Enqueue(task)
		s.queueSize.Add(1)
		telemetry.CurrentQueueSize.Inc()
	}
}

func (s *Scheduler) QueueSize() int {
	return int(s.queueSize.Load())
}

// GetTaskSnapshot returns a serializable snapshot of all tasks and their
// current status. The snapshot is built inside runLoop via a channel handshake
// to avoid data races. TaskInfo excludes non-copyable atomic fields.
func (s *Scheduler) GetTaskSnapshot() map[string]TaskInfo {
	replyCh := make(chan map[string]TaskInfo, 1)
	s.getStateChan <- replyCh
	return <-replyCh
}
