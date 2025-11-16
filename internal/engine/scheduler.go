package engine

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"sync"
	"time"

	"go-enterprise-scheduler/pkg/models"
)

type Scheduler struct {
	mu         sync.Mutex
	tasks      map[string]*models.Task
	inDegree   map[string]int
	dependents map[string][]string
	readyQueue *PriorityQueue
	taskChan   chan *models.Task
}

func NewScheduler() *Scheduler {
	return &Scheduler{
		tasks:      make(map[string]*models.Task),
		inDegree:   make(map[string]int),
		dependents: make(map[string][]string),
		readyQueue: NewPriorityQueue(),
		taskChan:   make(chan *models.Task, 100),
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	go s.runLoop(ctx)
}

func (s *Scheduler) runLoop(ctx context.Context) {
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.mu.Lock()
			for s.readyQueue.Len() > 0 {
				task := s.readyQueue.Dequeue()
				task.Status = models.StatusRunning
				s.taskChan <- task
			}
			s.mu.Unlock()
		}
	}
}

func (s *Scheduler) Ingest(tasks []models.Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()

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
			log.Println("SCHED: task ready")
			slog.Info("task ready", "task_id", t.ID, "reason", "no_dependencies")
		}
	}
	return nil
}

func (s *Scheduler) Complete(taskID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	task, exists := s.tasks[taskID]
	if !exists {
		slog.Warn("attempted to complete unknown task", "task_id", taskID)
		return
	}

	task.Status = models.StatusCompleted
	log.Println("SCHED: complete")
	slog.Info("task completed", "task_id", taskID)

	for _, depID := range s.dependents[taskID] {
		s.inDegree[depID]--
		if s.inDegree[depID] == 0 {
			depTask := s.tasks[depID]
			depTask.Status = models.StatusReady
			s.readyQueue.Enqueue(depTask)
			log.Println("SCHED: task ready")
			slog.Info("task ready", "task_id", depID, "reason", "deps_satisfied")
		}
	}
}

func (s *Scheduler) TaskChan() <-chan *models.Task {
	return s.taskChan
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
