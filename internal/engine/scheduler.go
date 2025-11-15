package engine

import (
	"fmt"
	"log"

	"go-enterprise-scheduler/pkg/models"
)

type Scheduler struct {
	tasks      map[string]*models.Task
	inDegree   map[string]int
	dependents map[string][]string
	readyQueue *PriorityQueue
}

func newScheduler() *Scheduler {
	return &Scheduler{
		tasks:      make(map[string]*models.Task),
		inDegree:   make(map[string]int),
		dependents: make(map[string][]string),
		readyQueue: NewPriorityQueue(),
	}
}

func (s *Scheduler) Ingest(tasks []models.Task) error {
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
			log.Println("task ready:", t.ID)
		}
	}
	return nil
}
