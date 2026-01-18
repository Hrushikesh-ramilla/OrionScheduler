package engine

import (
	"testing"

	"go-enterprise-scheduler/pkg/models"
)

func TestPriorityQueueOrdersByPriorityThenID(t *testing.T) {
	pq := NewPriorityQueue()
	pq.Enqueue(&models.Task{ID: "B", Priority: 2})
	pq.Enqueue(&models.Task{ID: "C", Priority: 1})
	pq.Enqueue(&models.Task{ID: "A", Priority: 1})

	got := []string{
		pq.Dequeue().ID,
		pq.Dequeue().ID,
		pq.Dequeue().ID,
	}
	want := []string{"A", "C", "B"}

	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("dequeue order = %v, want %v", got, want)
		}
	}
}
