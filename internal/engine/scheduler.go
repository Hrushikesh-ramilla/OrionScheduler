package engine

import (
	"context"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"go-enterprise-scheduler/internal/storage"
	"go-enterprise-scheduler/pkg/models"
	"go-enterprise-scheduler/pkg/telemetry"
)

// Atomic metrics are updated inside runLoop and read lock-free from any goroutine.
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

// ErrSchedulerStopped is returned when a caller attempts to send work to a
// scheduler whose run loop has already stopped.
var ErrSchedulerStopped = errors.New("scheduler stopped")

type taskWorkerReq struct {
	taskID   string
	workerID int
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
	completeChan chan taskWorkerReq
	failChan     chan taskWorkerReq
	popReqChan   chan chan *models.Task
	retryChan    chan string

	replayStartChan    chan string
	replayCompleteChan chan string
	replayFailChan     chan walReplayFailReq
	requeueOrphansChan chan struct {
		orphans map[string]bool
		done    chan struct{}
	}

	readyChan  chan *models.Task
	queueSize  atomic.Int64
	retryDelay func(retryCount int) time.Duration

	// EventChan receives task lifecycle events for external consumers (WebSocket hub).
	// Buffered 1000-deep and sent non-blocking so the event loop is never stalled.
	// Drops are counted via droppedEvents.
	EventChan chan models.TaskEvent

	// droppedEvents counts events silently dropped when EventChan buffer is full.
	// Exposed via DroppedEvents() and reported in /api/v1/metrics/live.
	droppedEvents atomic.Int64

	done        chan struct{}
	wg          sync.WaitGroup
	eventMu     sync.RWMutex
	eventClosed bool

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
		completeChan:       make(chan taskWorkerReq),
		failChan:           make(chan taskWorkerReq),
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
		done:         make(chan struct{}),
		retryDelay:   defaultRetryDelay,
		getStateChan: make(chan chan map[string]TaskInfo),
	}
}

func defaultRetryDelay(retryCount int) time.Duration {
	delay := time.Duration(1<<retryCount) * time.Second
	if delay > 30*time.Second {
		return 30 * time.Second
	}
	return delay
}

// emitEvent sends a task event to external consumers without ever blocking
// the scheduler event loop. If the channel buffer is full, the event is dropped
// and the droppedEvents counter is incremented so the drop is observable.
func (s *Scheduler) emitEvent(event models.TaskEvent) {
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	s.eventMu.RLock()
	defer s.eventMu.RUnlock()
	if s.eventClosed {
		return
	}

	select {
	case s.EventChan <- event:
	default:
		s.droppedEvents.Add(1)
	}
}

// CloseEventChan closes the external event stream after all scheduler and
// worker goroutines have stopped. It is safe to call more than once.
func (s *Scheduler) CloseEventChan() {
	s.eventMu.Lock()
	defer s.eventMu.Unlock()
	if s.eventClosed {
		return
	}
	close(s.EventChan)
	s.eventClosed = true
}

// DroppedEvents returns the cumulative count of events dropped due to
// EventChan buffer saturation. An increasing counter indicates slow
// WebSocket consumers or an undersized buffer.
func (s *Scheduler) DroppedEvents() int64 {
	return s.droppedEvents.Load()
}

// Wait blocks until scheduler-owned goroutines have exited.
func (s *Scheduler) Wait() {
	s.wg.Wait()
}

func (s *Scheduler) Start(ctx context.Context) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.runLoop(ctx)
	}()
	// Emit metrics snapshots every second so the frontend charts stay live.
	// This goroutine exits when the scheduler context is cancelled (SimulateCrash),
	// so charts stop updating after crash and resume after recovery.
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
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
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.pushLoop(ctx)
	}()
}

func (s *Scheduler) ReadyTasks() <-chan *models.Task {
	return s.readyChan
}

func (s *Scheduler) runLoop(ctx context.Context) {
	defer close(s.done)

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

		case req := <-s.completeChan:
			s.handleComplete(req)

		case req := <-s.failChan:
			s.handleFailure(req)

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
	batchIDs := make(map[string]bool, len(req.tasks))
	for i := range req.tasks {
		t := &req.tasks[i]
		if t.ID == "" {
			req.resp <- fmt.Errorf("scheduler: task ID is required")
			return
		}
		if batchIDs[t.ID] {
			req.resp <- fmt.Errorf("scheduler: duplicate task ID %q", t.ID)
			return
		}
		if _, exists := s.tasks[t.ID]; exists {
			req.resp <- fmt.Errorf("scheduler: duplicate task ID %q", t.ID)
			return
		}
		batchIDs[t.ID] = true
	}

	for i := range req.tasks {
		t := &req.tasks[i]
		depSeen := make(map[string]bool, len(t.Dependencies))
		for _, depID := range t.Dependencies {
			if depSeen[depID] {
				req.resp <- fmt.Errorf("scheduler: task %q has duplicate dependency %q", t.ID, depID)
				return
			}
			depSeen[depID] = true
			if !batchIDs[depID] {
				if _, exists := s.tasks[depID]; !exists {
					req.resp <- fmt.Errorf("scheduler: task %q depends on unknown task %q", t.ID, depID)
					return
				}
			}
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
		taskIDs = append(taskIDs, t.ID)

		unmetDeps := 0
		for _, depID := range t.Dependencies {
			if depTask, exists := s.tasks[depID]; exists && depTask.Status == models.StatusCompleted {
				continue
			}
			unmetDeps++
			s.dependents[depID] = append(s.dependents[depID], t.ID)
		}
		s.inDegree[t.ID] = unmetDeps
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
			// pending-to-ready is still "pending" in metrics (both count as pending)
			s.readyQueue.Enqueue(t)
			s.queueSize.Add(1)
			telemetry.CurrentQueueSize.Inc()
			log.Println("SCHED: task ready")
			slog.Info("task ready", "task_id", t.ID, "reason", "no_dependencies")
		}
	}
	req.resp <- nil
}

func (s *Scheduler) transitionToCompleted(task *models.Task) bool {
	switch task.Status {
	case models.StatusCompleted, models.StatusFailed:
		return false
	case models.StatusPending, models.StatusReady:
		s.metrics.pending.Add(-1)
	case models.StatusRunning:
		s.metrics.running.Add(-1)
	}
	s.metrics.completed.Add(1)
	task.Status = models.StatusCompleted
	return true
}

func (s *Scheduler) transitionToFailed(task *models.Task, countTelemetry bool) bool {
	switch task.Status {
	case models.StatusCompleted, models.StatusFailed:
		return false
	case models.StatusPending, models.StatusReady:
		s.metrics.pending.Add(-1)
	case models.StatusRunning:
		s.metrics.running.Add(-1)
	}
	s.metrics.failed.Add(1)
	task.Status = models.StatusFailed
	task.Cancelled.Store(1)
	if countTelemetry {
		telemetry.TasksFailedTotal.Inc()
	}
	return true
}

func (s *Scheduler) markReady(task *models.Task) {
	if task.Status == models.StatusFailed || task.Status == models.StatusCompleted {
		return
	}
	task.Status = models.StatusReady
	s.readyQueue.Enqueue(task)
	s.queueSize.Add(1)
	telemetry.CurrentQueueSize.Inc()
}

func (s *Scheduler) handleComplete(req taskWorkerReq) {
	log.Println("SCHED: complete")
	task, exists := s.tasks[req.taskID]
	if !exists {
		slog.Warn("attempted to complete unknown task", "task_id", req.taskID, "worker_id", req.workerID)
		return
	}
	if task.Status != models.StatusRunning {
		slog.Warn("ignoring completion for non-running task", "task_id", req.taskID, "worker_id", req.workerID, "status", task.Status)
		return
	}

	duration := float64(0)
	if !task.EndTime.IsZero() && !task.StartTime.IsZero() {
		duration = task.EndTime.Sub(task.StartTime).Seconds() * 1000
	}

	s.transitionToCompleted(task)
	telemetry.TasksCompletedTotal.Inc()
	slog.Info("task completed", "task_id", req.taskID, "worker_id", req.workerID)

	s.emitEvent(models.TaskEvent{
		Type:      models.EventTaskCompleted,
		TaskID:    req.taskID,
		WorkerID:  req.workerID,
		Duration:  duration,
		Timestamp: time.Now(),
	})

	for _, depID := range s.dependents[req.taskID] {
		s.inDegree[depID]--
		if s.inDegree[depID] == 0 {
			depTask := s.tasks[depID]
			s.markReady(depTask)
			log.Println("SCHED: task ready")
			slog.Info("task ready", "task_id", depID, "reason", "deps_satisfied")
		}
	}
}

func (s *Scheduler) handleFailure(req taskWorkerReq) {
	task, exists := s.tasks[req.taskID]
	if !exists {
		slog.Warn("attempted to fail unknown task", "task_id", req.taskID, "worker_id", req.workerID)
		return
	}
	if task.Status != models.StatusRunning {
		slog.Warn("ignoring failure for non-running task", "task_id", req.taskID, "worker_id", req.workerID, "status", task.Status)
		return
	}

	if task.RetryCount < task.MaxRetries {
		task.RetryCount++
		telemetry.TasksRetriedTotal.Inc()
		delay := s.retryDelay(task.RetryCount)
		slog.Warn("task failed, retrying", "task_id", req.taskID, "worker_id", req.workerID, "delay", delay.String(), "attempt", task.RetryCount, "max_retries", task.MaxRetries)

		s.metrics.running.Add(-1)
		s.metrics.pending.Add(1)
		s.metrics.retried.Add(1)
		task.Status = models.StatusPending

		s.emitEvent(models.TaskEvent{
			Type:      models.EventTaskRetry,
			TaskID:    req.taskID,
			WorkerID:  req.workerID,
			Retry:     task.RetryCount,
			MaxRetry:  task.MaxRetries,
			Timestamp: time.Now(),
		})

		time.AfterFunc(delay, func() {
			select {
			case s.retryChan <- req.taskID:
			case <-s.done:
			}
		})
	} else {
		s.emitEvent(models.TaskEvent{
			Type:      models.EventTaskFailed,
			TaskID:    req.taskID,
			WorkerID:  req.workerID,
			Retry:     task.RetryCount,
			MaxRetry:  task.MaxRetries,
			Timestamp: time.Now(),
		})

		// Permanent failure cascades to all downstream dependents.
		s.propagateFailure(req.taskID)
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

		if !s.transitionToFailed(task, true) {
			continue
		}
		// Use AppendCascadeFail so that WAL replay knows this task was killed
		// by cascade propagation and must NOT be re-enqueued or have its retry
		// counter incremented. The root failure is written by the worker itself
		// via AppendFail before calling scheduler.Fail.
		if current != rootID {
			if err := s.wal.AppendCascadeFail(current); err != nil {
				slog.Error("failed to persist cascade failure to WAL", "task_id", current, "error", err)
			}
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

// Metrics reads atomic counters with zero blocking, safe from any goroutine.
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
	select {
	case s.ingestChan <- req:
	case <-s.done:
		return ErrSchedulerStopped
	}

	select {
	case err := <-req.resp:
		return err
	case <-s.done:
		return ErrSchedulerStopped
	}
}

func (s *Scheduler) Complete(taskID string, workerID int) bool {
	req := taskWorkerReq{taskID: taskID, workerID: workerID}
	select {
	case s.completeChan <- req:
		return true
	case <-s.done:
		return false
	}
}

func (s *Scheduler) ReplayStart(taskID string) bool {
	select {
	case s.replayStartChan <- taskID:
		return true
	case <-s.done:
		return false
	}
}

func (s *Scheduler) handleReplayStart(taskID string) {
	task, exists := s.tasks[taskID]
	if !exists {
		return
	}
	if task.Status == models.StatusRunning || task.Status == models.StatusCompleted || task.Status == models.StatusFailed {
		return
	}
	if task.Status == models.StatusPending || task.Status == models.StatusReady {
		s.metrics.pending.Add(-1)
	}
	s.metrics.running.Add(1)
	task.Status = models.StatusRunning
}

func (s *Scheduler) RequeueOrphans(inProgress map[string]bool) bool {
	req := make(chan struct{})
	payload := struct {
		orphans map[string]bool
		done    chan struct{}
	}{inProgress, req}
	select {
	case s.requeueOrphansChan <- payload:
	case <-s.done:
		return false
	}
	select {
	case <-req:
		return true
	case <-s.done:
		return false
	}
}

func (s *Scheduler) handleRequeueOrphans(orphans map[string]bool) {
	for taskID := range orphans {
		if task, exists := s.tasks[taskID]; exists {
			if task.Status != models.StatusRunning {
				continue
			}
			// Orphans were running at crash time; metrics already show
			// them as running from handleReplayStart, move to pending.
			s.metrics.running.Add(-1)
			s.metrics.pending.Add(1)
			s.markReady(task)
			slog.Info("requeued orphan task", "task_id", taskID)
		}
	}
}

func (s *Scheduler) ReplayComplete(taskID string) bool {
	select {
	case s.replayCompleteChan <- taskID:
		return true
	case <-s.done:
		return false
	}
}

func (s *Scheduler) handleReplayComplete(taskID string) {
	task, exists := s.tasks[taskID]
	if !exists {
		return
	}
	if !s.transitionToCompleted(task) {
		return
	}

	for _, depID := range s.dependents[taskID] {
		s.inDegree[depID]--
		if s.inDegree[depID] == 0 {
			depTask := s.tasks[depID]
			s.markReady(depTask)
		}
	}
}

func (s *Scheduler) Fail(taskID string, workerID int) bool {
	req := taskWorkerReq{taskID: taskID, workerID: workerID}
	select {
	case s.failChan <- req:
		return true
	case <-s.done:
		return false
	}
}

// ReplayFail replays a WAL FAIL record. isCascade must be true when the WAL
// entry was written by propagateFailure (AppendCascadeFail), and false when
// written by a worker (AppendFail). The distinction drives different replay logic.
func (s *Scheduler) ReplayFail(taskID string, isCascade bool) bool {
	req := walReplayFailReq{taskID: taskID, isCascade: isCascade}
	select {
	case s.replayFailChan <- req:
		return true
	case <-s.done:
		return false
	}
}

func (s *Scheduler) handleReplayFail(req walReplayFailReq) {
	task, exists := s.tasks[req.taskID]
	if !exists {
		return
	}

	if req.isCascade {
		// Cascade-killed tasks were never running: do NOT adjust the running
		// counter, do NOT increment RetryCount, do NOT re-enqueue. They must
		// remain permanently failed exactly as they were at crash time.
		s.transitionToFailed(task, false)
		return
	}

	if task.Status != models.StatusRunning {
		return
	}

	// Organic failure: apply the same retry boundary as live execution.
	if task.RetryCount < task.MaxRetries {
		task.RetryCount++
		s.metrics.running.Add(-1)
		s.metrics.pending.Add(1)
		s.metrics.retried.Add(1)
		s.markReady(task)
		return
	}

	s.transitionToFailed(task, false)
}

func (s *Scheduler) QueueSize() int {
	return int(s.queueSize.Load())
}

// GetTaskSnapshot returns a serializable snapshot of all tasks and their
// current status. The snapshot is built inside runLoop via a channel handshake
// to avoid data races. TaskInfo excludes non-copyable atomic fields.
func (s *Scheduler) GetTaskSnapshot() map[string]TaskInfo {
	replyCh := make(chan map[string]TaskInfo, 1)
	select {
	case s.getStateChan <- replyCh:
	case <-s.done:
		return map[string]TaskInfo{}
	}

	select {
	case snap := <-replyCh:
		return snap
	case <-s.done:
		return map[string]TaskInfo{}
	}
}
