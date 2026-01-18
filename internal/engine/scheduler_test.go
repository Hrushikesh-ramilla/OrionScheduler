package engine

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"go-enterprise-scheduler/internal/storage"
	"go-enterprise-scheduler/pkg/models"
)

func newTestWAL(t *testing.T) *storage.WAL {
	t.Helper()
	wal, err := storage.NewWAL(filepath.Join(t.TempDir(), "wal.json"))
	if err != nil {
		t.Fatalf("NewWAL: %v", err)
	}
	t.Cleanup(func() {
		if err := wal.Close(); err != nil {
			t.Fatalf("Close WAL: %v", err)
		}
	})
	return wal
}

func readEvent(t *testing.T, ch <-chan models.TaskEvent) models.TaskEvent {
	t.Helper()
	select {
	case event := <-ch:
		return event
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for event")
	}
	return models.TaskEvent{}
}

func runWithin(t *testing.T, timeout time.Duration, fn func()) {
	t.Helper()
	done := make(chan struct{})
	go func() {
		defer close(done)
		fn()
	}()

	select {
	case <-done:
	case <-time.After(timeout):
		t.Fatalf("operation did not finish within %s", timeout)
	}
}

func eventually(t *testing.T, timeout time.Duration, fn func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if fn() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("condition was not met within %s", timeout)
}

func TestReplayRetryBoundaryMatchesLiveSemantics(t *testing.T) {
	s := NewScheduler(newTestWAL(t))
	task := &models.Task{ID: "task", Status: models.StatusRunning, MaxRetries: 3}
	s.tasks[task.ID] = task
	s.metrics.running.Store(1)

	for attempt := 1; attempt <= 3; attempt++ {
		s.handleReplayFail(walReplayFailReq{taskID: task.ID})
		if task.RetryCount != attempt {
			t.Fatalf("attempt %d: expected retry count %d, got %d", attempt, attempt, task.RetryCount)
		}
		if task.Status != models.StatusReady {
			t.Fatalf("attempt %d: expected ready status, got %q", attempt, task.Status)
		}
		pending, running, _, failed, retried := s.Metrics()
		if pending != 1 || running != 0 || failed != 0 || retried != attempt {
			t.Fatalf("attempt %d: metrics pending=%d running=%d failed=%d retried=%d", attempt, pending, running, failed, retried)
		}

		s.handleReplayStart(task.ID)
	}

	s.handleReplayFail(walReplayFailReq{taskID: task.ID})
	if task.RetryCount != 3 {
		t.Fatalf("permanent fail should not increment retry count, got %d", task.RetryCount)
	}
	if task.Status != models.StatusFailed {
		t.Fatalf("expected failed status, got %q", task.Status)
	}
	pending, running, _, failed, retried := s.Metrics()
	if pending != 0 || running != 0 || failed != 1 || retried != 3 {
		t.Fatalf("final metrics pending=%d running=%d failed=%d retried=%d", pending, running, failed, retried)
	}
}

func TestHandleIngestRejectsDuplicateAndUnknownDependencies(t *testing.T) {
	tests := []struct {
		name  string
		tasks []models.Task
	}{
		{
			name: "duplicate batch IDs",
			tasks: []models.Task{
				{ID: "a"},
				{ID: "a"},
			},
		},
		{
			name: "unknown dependency",
			tasks: []models.Task{
				{ID: "a", Dependencies: []string{"missing"}},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := NewScheduler(newTestWAL(t))
			resp := make(chan error, 1)

			s.handleIngest(ingestReq{tasks: tt.tasks, resp: resp})

			if err := <-resp; err == nil {
				t.Fatalf("expected ingest error")
			}
		})
	}
}

func TestReplayFailIgnoresDuplicateCascadeAfterPermanentFailure(t *testing.T) {
	s := NewScheduler(newTestWAL(t))
	task := &models.Task{ID: "root", Status: models.StatusRunning, MaxRetries: 0}
	s.tasks[task.ID] = task
	s.metrics.running.Store(1)

	s.handleReplayFail(walReplayFailReq{taskID: task.ID})
	s.handleReplayFail(walReplayFailReq{taskID: task.ID, isCascade: true})

	pending, running, _, failed, retried := s.Metrics()
	if pending != 0 || running != 0 || failed != 1 || retried != 0 {
		t.Fatalf("metrics after duplicate fail pending=%d running=%d failed=%d retried=%d", pending, running, failed, retried)
	}
	if task.Status != models.StatusFailed {
		t.Fatalf("expected failed status, got %q", task.Status)
	}
}

func TestPermanentFailureCascadesWithoutRootCascadeWAL(t *testing.T) {
	wal := newTestWAL(t)
	s := NewScheduler(wal)
	root := &models.Task{ID: "root", Status: models.StatusRunning, MaxRetries: 0}
	child := &models.Task{ID: "child", Status: models.StatusPending}
	grandchild := &models.Task{ID: "grandchild", Status: models.StatusReady}
	s.tasks[root.ID] = root
	s.tasks[child.ID] = child
	s.tasks[grandchild.ID] = grandchild
	s.dependents[root.ID] = []string{child.ID}
	s.dependents[child.ID] = []string{grandchild.ID}
	s.metrics.running.Store(1)
	s.metrics.pending.Store(2)

	s.handleFailure(taskWorkerReq{taskID: root.ID, workerID: 7})

	if root.Status != models.StatusFailed || child.Status != models.StatusFailed || grandchild.Status != models.StatusFailed {
		t.Fatalf("expected cascade to fail all tasks, got root=%q child=%q grandchild=%q", root.Status, child.Status, grandchild.Status)
	}
	pending, running, _, failed, _ := s.Metrics()
	if pending != 0 || running != 0 || failed != 3 {
		t.Fatalf("metrics after cascade pending=%d running=%d failed=%d", pending, running, failed)
	}
	event := readEvent(t, s.EventChan)
	if event.Type != models.EventTaskFailed || event.WorkerID != 7 {
		t.Fatalf("expected failed event with worker 7, got type=%q worker=%d", event.Type, event.WorkerID)
	}

	state, err := wal.Recover()
	if err != nil {
		t.Fatalf("Recover: %v", err)
	}
	if len(state.Entries) != 2 {
		t.Fatalf("expected cascade WAL entries for dependents only, got %d", len(state.Entries))
	}
	for _, entry := range state.Entries {
		if entry.TaskID == root.ID {
			t.Fatalf("root failure should not be written as cascade fail")
		}
		if !entry.IsCascade {
			t.Fatalf("expected cascade WAL entry, got %+v", entry)
		}
	}
}

func TestLifecycleEventsIncludeWorkerID(t *testing.T) {
	t.Run("complete", func(t *testing.T) {
		s := NewScheduler(newTestWAL(t))
		task := &models.Task{ID: "done", Status: models.StatusRunning}
		s.tasks[task.ID] = task
		s.metrics.running.Store(1)

		s.handleComplete(taskWorkerReq{taskID: task.ID, workerID: 4})

		event := readEvent(t, s.EventChan)
		if event.Type != models.EventTaskCompleted || event.WorkerID != 4 {
			t.Fatalf("expected complete event with worker 4, got type=%q worker=%d", event.Type, event.WorkerID)
		}
		if event.Timestamp.IsZero() {
			t.Fatalf("expected complete event timestamp")
		}
	})

	t.Run("retry", func(t *testing.T) {
		s := NewScheduler(newTestWAL(t))
		s.retryDelay = func(int) time.Duration { return time.Millisecond }
		task := &models.Task{ID: "retry", Status: models.StatusRunning, MaxRetries: 1}
		s.tasks[task.ID] = task
		s.metrics.running.Store(1)

		s.handleFailure(taskWorkerReq{taskID: task.ID, workerID: 9})
		close(s.done)

		event := readEvent(t, s.EventChan)
		if event.Type != models.EventTaskRetry || event.WorkerID != 9 {
			t.Fatalf("expected retry event with worker 9, got type=%q worker=%d", event.Type, event.WorkerID)
		}
		if event.Timestamp.IsZero() {
			t.Fatalf("expected retry event timestamp")
		}
	})
}

func TestStoppedSchedulerNotificationsReturn(t *testing.T) {
	s := NewScheduler(newTestWAL(t))
	close(s.done)

	if ok := s.Complete("missing", 1); ok {
		t.Fatalf("expected Complete to return false after scheduler stop")
	}
	if ok := s.Fail("missing", 1); ok {
		t.Fatalf("expected Fail to return false after scheduler stop")
	}
	if err := s.Ingest([]models.Task{{ID: "x"}}); !errors.Is(err, ErrSchedulerStopped) {
		t.Fatalf("expected ErrSchedulerStopped, got %v", err)
	}
	if ok := s.ReplayStart("x"); ok {
		t.Fatalf("expected ReplayStart to return false after scheduler stop")
	}
	if snap := s.GetTaskSnapshot(); len(snap) != 0 {
		t.Fatalf("expected empty snapshot after scheduler stop, got %d tasks", len(snap))
	}
}

func TestManagerCrashRecoverNoHang(t *testing.T) {
	wal := newTestWAL(t)
	manager := NewSchedulerManager(wal, 1)
	scheduler := manager.Start()

	tasks := []models.Task{{ID: "sleeping", Payload: "sleep", MaxRetries: 1}}
	if err := wal.AppendIngest(tasks); err != nil {
		t.Fatalf("AppendIngest: %v", err)
	}
	if err := scheduler.Ingest(tasks); err != nil {
		t.Fatalf("Ingest: %v", err)
	}

	eventually(t, 2*time.Second, func() bool {
		_, running, _, _, _ := scheduler.Metrics()
		return running > 0
	})

	runWithin(t, time.Second, manager.SimulateCrash)
	if manager.IsRunning() {
		t.Fatalf("expected manager to be stopped after crash")
	}

	var recovered *Scheduler
	runWithin(t, time.Second, func() {
		recovered = manager.Recover()
	})
	if recovered == nil {
		t.Fatalf("expected recovered scheduler")
	}
	if !manager.IsRunning() {
		t.Fatalf("expected manager to be running after recover")
	}

	runWithin(t, time.Second, manager.SimulateCrash)
}
