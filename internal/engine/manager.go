package engine

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"

	"go-enterprise-scheduler/internal/storage"
	"go-enterprise-scheduler/pkg/models"
)

// SchedulerManager wraps the Scheduler and Dispatcher lifecycle so
// that the scheduler can be stopped (crash simulation) and restarted
// (recovery) while keeping the HTTP server alive.
type SchedulerManager struct {
	mu         sync.Mutex
	scheduler  *Scheduler
	dispatcher *Dispatcher
	cancel     context.CancelFunc
	wal        *storage.WAL
	running    atomic.Bool

	workerCount int
}

// NewSchedulerManager creates a manager that controls a scheduler + dispatcher pair.
func NewSchedulerManager(wal *storage.WAL, workerCount int) *SchedulerManager {
	return &SchedulerManager{
		wal:         wal,
		workerCount: workerCount,
	}
}

// Start creates a new Scheduler and Dispatcher, replays the WAL,
// and starts all goroutines. Returns the Scheduler so callers can
// wire it into the API and WebSocket hub.
func (m *SchedulerManager) Start() *Scheduler {
	m.mu.Lock()
	defer m.mu.Unlock()

	ctx, cancel := context.WithCancel(context.Background())
	m.cancel = cancel

	scheduler := NewScheduler(m.wal)
	scheduler.Start(ctx)
	slog.Info("scheduler event loop started")

	// WAL recovery
	state, err := m.wal.Recover()
	if err != nil {
		slog.Error("WAL recovery failed", "error", err)
	}
	if state != nil && len(state.Entries) > 0 {
		slog.Info("recovering WAL events", "count", len(state.Entries))
		for _, entry := range state.Entries {
			switch entry.Type {
			case "INGEST":
				_ = scheduler.Ingest(entry.Tasks)
			case "START":
				scheduler.ReplayStart(entry.TaskID)
			case "COMPLETE":
				scheduler.ReplayComplete(entry.TaskID)
			case "FAIL":
				scheduler.ReplayFail(entry.TaskID, entry.IsCascade)
			}
		}

		orphanCount := len(state.InProgressTasks)
		scheduler.RequeueOrphans(state.InProgressTasks)

		// Emit recovery event so the frontend can show what happened.
		completed := len(state.CompletedTasks)
		failed := len(state.FailedTasks)
		scheduler.emitEvent(models.TaskEvent{
			Type: models.EventSystemRecover,
			Metadata: map[string]string{
				"completed_recovered": fmt.Sprintf("%d", completed),
				"failed_recovered":    fmt.Sprintf("%d", failed),
				"orphans_requeued":    fmt.Sprintf("%d", orphanCount),
			},
		})

		slog.Info("WAL recovery complete",
			"completed", completed,
			"failed", failed,
			"orphans_requeued", orphanCount,
		)
	} else {
		slog.Info("WAL is clean — no tasks to recover")
	}

	scheduler.StartDispatch(ctx)
	slog.Info("dispatch loop started")

	dispatcher := NewDispatcher(scheduler, m.wal, m.workerCount)
	dispatcher.Start(ctx)
	slog.Info("dispatcher started", "workers", m.workerCount)

	m.scheduler = scheduler
	m.dispatcher = dispatcher
	m.running.Store(true)

	return scheduler
}

// Scheduler returns the current Scheduler, or nil if not running.
func (m *SchedulerManager) Scheduler() *Scheduler {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.scheduler
}

// IsRunning reports whether the scheduler is currently active.
func (m *SchedulerManager) IsRunning() bool {
	return m.running.Load()
}

// SimulateCrash cancels the scheduler context, causing the event loop,
// dispatch loop, and all workers to drain and stop. The WAL and HTTP
// server remain intact.
func (m *SchedulerManager) SimulateCrash() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cancel != nil {
		// Notify connected clients before killing the scheduler.
		if m.scheduler != nil {
			m.scheduler.emitEvent(models.TaskEvent{
				Type: models.EventSystemCrash,
			})
		}

		m.cancel()
		if m.dispatcher != nil {
			// Wait for all workers to finish — after this point no goroutine
			// will ever write to EventChan again, so it is safe to close it.
			m.dispatcher.Wait()
		}
		if m.scheduler != nil {
			// Closing EventChan causes the hub.Run goroutine (which is ranging
			// over this channel) to exit cleanly. Without this close, that
			// goroutine leaks permanently on every crash/recover cycle.
			close(m.scheduler.EventChan)
		}
		m.scheduler = nil
		m.dispatcher = nil
		m.cancel = nil
		m.running.Store(false)
		slog.Info("scheduler crashed (simulated)")
	}
}

// Recover restarts the scheduler and replays the WAL. Returns the new
// Scheduler instance so callers can update their references.
func (m *SchedulerManager) Recover() *Scheduler {
	slog.Info("recovering scheduler from WAL...")
	return m.Start()
}
