package engine

import (
	"fmt"
	"sync"
	"time"
)

// DAGInfo tracks a submitted DAG's tasks and current progress.
type DAGInfo struct {
	ID          string    `json:"id"`
	TaskIDs     []string  `json:"task_ids"`
	TaskCount   int       `json:"task_count"`
	SubmittedAt time.Time `json:"submitted_at"`
}

// DAGStore provides a thread-safe registry of submitted DAGs.
// It tracks which tasks belong to each DAG for status reporting.
type DAGStore struct {
	mu   sync.RWMutex
	dags map[string]*DAGInfo
	seq  int
}

// NewDAGStore creates an empty DAG store.
func NewDAGStore() *DAGStore {
	return &DAGStore{
		dags: make(map[string]*DAGInfo),
	}
}

// Track registers a new DAG submission with its task IDs.
// Returns the generated DAG ID.
func (ds *DAGStore) Track(taskIDs []string) string {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	ds.seq++
	dagID := fmt.Sprintf("dag-%d", ds.seq)

	ds.dags[dagID] = &DAGInfo{
		ID:          dagID,
		TaskIDs:     taskIDs,
		TaskCount:   len(taskIDs),
		SubmittedAt: time.Now(),
	}

	return dagID
}

// List returns all tracked DAGs.
func (ds *DAGStore) List() []*DAGInfo {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	result := make([]*DAGInfo, 0, len(ds.dags))
	for _, dag := range ds.dags {
		result = append(result, dag)
	}
	return result
}

// Get returns a single DAG by ID, or nil if not found.
func (ds *DAGStore) Get(dagID string) *DAGInfo {
	ds.mu.RLock()
	defer ds.mu.RUnlock()
	return ds.dags[dagID]
}
