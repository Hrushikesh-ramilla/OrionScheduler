package engine

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"sync"

	"go-enterprise-scheduler/pkg/models"
)

type Scheduler struct {
	mu         sync.Mutex
	tasks      map[string]*models.Task
	inDegree   map[string]int
	dependents map[string][]string
	readyQueue *PriorityQueue
	readyChan  chan *models.Task
}

func NewScheduler() *Scheduler {
	return &Scheduler{
		tasks:      make(map[string]*models.Task),
		inDegree:   make(map[string]int),
		dependents: make(map[string][]string),
		readyQueue: NewPriorityQueue(),
		readyChan:  make(chan *models.Task, 64), // buffered to avoid deadlock
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	// mutex model â€” no event loop
}

func (s *Scheduler) Ingest(tasks []models.Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	log.Println("SCHED: ingest")
	for i := range tasks {
		t := &tasks[i]
		if _, exists := s.tasks[t.ID]; exists {
			return fmt.Errorf("scheduler: duplicate task ID %q", t.ID)
		}
	}
	for i := range tasks {
		t := &tasks[i]
		t.Status = models.StatusPending
		s.tasks[t.ID] = t
		s.inDegree[t.ID] = len(t.Dependencies)
		for _, depID := range t.Dependencies {
			s.dependents[depID] = append(s.dependents[depID], t.ID)
		}
	}
	for i := range tasks {
		t := &tasks[i]
		if s.inDegree[t.ID] == 0 {
			t.Status = models.StatusReady
			s.readyQueue.Enqueue(t)
		}
	}
	s.dispatchLocked()
	return nil
}

func (s *Scheduler) dispatchLocked() {
	for s.readyQueue.Len() > 0 {
		task := s.readyQueue.Dequeue()
		task.Status = models.StatusRunning
		select {
		case s.readyChan <- task:
		default:
			// channel full â€” put back and try later
			// NOTE: this is still broken under real concurrency
			s.readyQueue.Enqueue(task)
			task.Status = models.StatusReady
			return
		}
	}
}

func (s *Scheduler) Complete(taskID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	task, exists := s.tasks[taskID]
	if !exists { return }
	task.Status = models.StatusCompleted
	slog.Info("task completed", "task_id", taskID)
	for _, depID := range s.dependents[taskID] {
		s.inDegree[depID]--
		if s.inDegree[depID] == 0 {
			depTask := s.tasks[depID]
			depTask.Status = models.StatusReady
			s.readyQueue.Enqueue(depTask)
		}
	}
	s.dispatchLocked()
}

func (s *Scheduler) ReadyTasks() <-chan *models.Task {
	return s.readyChan
}

func (s *Scheduler) Metrics() (pending, running, completed int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, t := range s.tasks {
		switch t.Status {
		case models.StatusPending, models.StatusReady:
			pending++
		case models.StatusRunning:
			running++
		case models.StatusCompleted:
			completed++
		}
	}
	return
}
