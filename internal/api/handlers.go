// Package api implements the HTTP REST interface for the Distributed
// Task Orchestrator. It exposes endpoints for submitting DAGs and
// querying system status.
package api

import (
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	"net"
	"net/http"
	"os"
	"sync"
	"time"

	"go-enterprise-scheduler/internal/engine"
	"go-enterprise-scheduler/internal/storage"
	"go-enterprise-scheduler/pkg/models"
	
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"golang.org/x/time/rate"
)

// -----------------------------------------------------------------
// Handler wires the HTTP routes to the engine and storage layers.
// -----------------------------------------------------------------

var serverStartTime = time.Now()

// Handler holds references to shared dependencies and registers HTTP routes.
type Handler struct {
	manager   *engine.SchedulerManager
	wal       *storage.WAL
	mu        sync.Mutex
	clients   map[string]*rate.Limiter
	idemStore *IdempotencyStore
	hub       *Hub
	dagStore  *engine.DAGStore
}

// NewHandler creates a Handler and returns a configured http.ServeMux
// with all API routes registered.
func NewHandler(manager *engine.SchedulerManager, wal *storage.WAL, idemStore *IdempotencyStore, hub *Hub, dagStore *engine.DAGStore) http.Handler {
	h := &Handler{
		manager:   manager,
		wal:       wal,
		clients:   make(map[string]*rate.Limiter),
		idemStore: idemStore,
		hub:       hub,
		dagStore:  dagStore,
	}

	mux := http.NewServeMux()

	// POST /api/v1/dag — Submit a DAG of tasks for scheduling.
	mux.HandleFunc("/api/v1/dag", h.handleSubmitDAG)

	// GET /api/v1/status — Retrieve current system metrics.
	mux.HandleFunc("/api/v1/status", h.handleStatus)

	// GET /api/v1/metrics/live — Rich metrics for frontend dashboard.
	mux.HandleFunc("/api/v1/metrics/live", h.handleMetricsLive)

	// GET /api/v1/dags — List all submitted DAGs.
	mux.HandleFunc("/api/v1/dags", h.handleListDAGs)

	// GET /api/v1/dag/state — Current DAG topology + per-task status for graph reconstruction.
	mux.HandleFunc("/api/v1/dag/state", h.handleDAGState)

	// GET /healthz — Liveness probe (always 200).
	mux.HandleFunc("/healthz", h.handleHealthz)

	// GET /readyz — Readiness probe (200 only if scheduler + WAL ready).
	mux.HandleFunc("/readyz", h.handleReadyz)

	// GET /metrics — Prometheus metrics endpoint natively scraped
	mux.Handle("/metrics", promhttp.Handler())

	// GET /ws — WebSocket endpoint for real-time event streaming
	mux.HandleFunc("/ws", hub.HandleWS)

	return corsMiddleware(mux)
}

// corsMiddleware adds CORS headers to all responses. In development,
// it allows all origins. In production, set CORS_ORIGIN env var.
func corsMiddleware(next http.Handler) http.Handler {
	allowOrigin := os.Getenv("CORS_ORIGIN")
	if allowOrigin == "" {
		allowOrigin = "*"
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (h *Handler) getLimiter(ip string) *rate.Limiter {
	h.mu.Lock()
	defer h.mu.Unlock()

	limiter, exists := h.clients[ip]
	if !exists {
		limiter = rate.NewLimiter(5, 10) // stricter per-client
		h.clients[ip] = limiter
	}
	return limiter
}

// -----------------------------------------------------------------
// POST /api/v1/dag
// -----------------------------------------------------------------
// Accepts a JSON array of Task objects. The tasks are first persisted
// to the WAL for crash recovery, then injected into the DAG scheduler.
//
// Request body example:
//
//	[
//	  {"id": "build", "payload": "go build ./...", "priority": 1, "dependencies": []},
//	  {"id": "test",  "payload": "go test ./...",  "priority": 2, "dependencies": ["build"]}
//	]
//
// Responses:
//
//	201 Created  — Tasks accepted and queued.
//	400 Bad Request — Malformed JSON body.
//	405 Method Not Allowed — Non-POST request.
//	500 Internal Server Error — WAL or scheduler failure.
func (h *Handler) handleSubmitDAG(w http.ResponseWriter, r *http.Request) {
	log.Println("API: request received")
	defer log.Println("API: request completed")

	// Enforce POST method.
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	if ip != "127.0.0.1" && ip != "::1" {
		limiter := h.getLimiter(ip)
		if !limiter.Allow() {
			http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}
	}

	key := r.Header.Get("Idempotency-Key")
	if key == "" {
		http.Error(w, `{"error":"missing Idempotency-Key header"}`, http.StatusBadRequest)
		return
	}

	if res, ok := h.idemStore.Get(key); ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(res.Response)
		return
	}

	// Prevent huge JSON bombs. Max 1MB
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	// Decode the incoming task array.
	var tasks []models.Task
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields() // Strict parsing.
	if err := decoder.Decode(&tasks); err != nil {
		slog.Warn("bad request", "error", err)
		http.Error(w, `{"error":"invalid JSON body: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Validate: at least one task must be provided.
	if len(tasks) == 0 {
		http.Error(w, `{"error":"empty task list"}`, http.StatusBadRequest)
		return
	}

	sched := h.manager.Scheduler()
	if sched == nil {
		http.Error(w, `{"error":"scheduler is offline or recovering"}`, http.StatusServiceUnavailable)
		return
	}

	// Emulate true execution latency coupling without hard-blocking API concurrency maps:
	// If internal pipeline crosses ~50 items, inject native execution backpressure.
	for sched.QueueSize() > 50 {
		time.Sleep(10 * time.Millisecond)
	}

	const MaxTasksPerRequest = 1000
	if len(tasks) > MaxTasksPerRequest {
		http.Error(w, `{"error":"too many tasks in request"}`, http.StatusBadRequest)
		return
	}

	const MaxDepsPerTask = 50

	for i := range tasks {
		if len(tasks[i].Dependencies) > MaxDepsPerTask {
			http.Error(w, `{"error":"too many dependencies"}`, http.StatusBadRequest)
			return
		}
	}

	const MaxQueueSize = 10000
	if sched.QueueSize() > MaxQueueSize {
		http.Error(w, `{"error":"system overloaded"}`, http.StatusTooManyRequests)
		return
	}

	// Validate DAG structure: no cycles, at least one root node.
	if err := validateDAG(tasks); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	// Step 1: Persist to WAL before processing (write-ahead guarantee).
	if err := h.wal.AppendIngest(tasks); err != nil {
		slog.Error("WAL ingest failed", "error", err)
		http.Error(w, `{"error":"persistence failure"}`, http.StatusInternalServerError)
		return
	}

	// Step 2: Inject into the DAG scheduler.
	if err := sched.Ingest(tasks); err != nil {
		slog.Error("scheduler ingest failed", "error", err)
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	slog.Info("accepted tasks into the DAG", "count", len(tasks))

	// Step 3: Track the DAG for listing.
	taskIDs := make([]string, len(tasks))
	for i := range tasks {
		taskIDs[i] = tasks[i].ID
	}
	dagID := h.dagStore.Track(taskIDs)

	// Return 201 Created with a summary.
	respData := map[string]interface{}{
		"status":   "accepted",
		"ingested": len(tasks),
		"dag_id":   dagID,
	}
	respBytes, _ := json.Marshal(respData)

	h.idemStore.Set(key, Result{
		Status:   "accepted",
		Response: respBytes,
	})
	_ = h.wal.AppendRequest(key)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	w.Write(respBytes)
}

// -----------------------------------------------------------------
// GET /api/v1/status
// -----------------------------------------------------------------
// Returns a JSON object with the current system metrics: counts of
// tasks in pending, running, and completed states.
//
// Response example:
//
//	{"pending": 3, "running": 2, "completed": 5}
func (h *Handler) handleStatus(w http.ResponseWriter, r *http.Request) {
	// Enforce GET method.
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	sched := h.manager.Scheduler()
	if sched == nil {
		http.Error(w, `{"error":"scheduler offline"}`, http.StatusServiceUnavailable)
		return
	}

	pending, running, completed, failed, retried := sched.Metrics()

	w.Header().Set("Content-Type", "application/json")
	resp := map[string]int{
		"pending":   pending,
		"running":   running,
		"completed": completed,
		"failed":    failed,
		"retried":   retried,
	}
	json.NewEncoder(w).Encode(resp)
}

// -----------------------------------------------------------------
// GET /healthz
// -----------------------------------------------------------------
// Kubernetes-style liveness probe. Always returns 200 if the process
// is alive and serving HTTP.
func (h *Handler) handleHealthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"alive"}`))
}

// -----------------------------------------------------------------
// GET /readyz
// -----------------------------------------------------------------
// Kubernetes-style readiness probe. Returns 200 only if both the
// scheduler event loop and the WAL are initialized and operational.
func (h *Handler) handleReadyz(w http.ResponseWriter, r *http.Request) {
	sched := h.manager.Scheduler()
	if sched == nil {
		http.Error(w, `{"error":"scheduler offline"}`, http.StatusServiceUnavailable)
		return
	}

	if h.wal == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"status":"not ready","reason":"scheduler or WAL not initialized"}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ready"}`))
}

// -----------------------------------------------------------------
// GET /api/v1/metrics/live
// -----------------------------------------------------------------
// Returns an enriched JSON object with system metrics for the frontend
// dashboard, including uptime, queue size, and connected clients.
func (h *Handler) handleMetricsLive(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	sched := h.manager.Scheduler()
	if sched == nil {
		http.Error(w, `{"error":"scheduler offline"}`, http.StatusServiceUnavailable)
		return
	}

	pending, running, completed, failed, retried := sched.Metrics()
	queueSize := sched.QueueSize()

	wsClients := 0
	if h.hub != nil {
		wsClients = h.hub.ClientCount()
	}

	resp := map[string]interface{}{
		"pending":        pending,
		"running":        running,
		"completed":      completed,
		"failed":         failed,
		"retried":        retried,
		"queue_size":     queueSize,
		"ws_clients":     wsClients,
		"uptime_seconds": int(time.Since(serverStartTime).Seconds()),
		"workers":        4, // matches DefaultWorkerCount
		"dropped_events": sched.DroppedEvents(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// -----------------------------------------------------------------
// GET /api/v1/dag/state
// -----------------------------------------------------------------
// Returns the current task topology and per-task status for all active
// executions. Used by the frontend on mount and after system.recover to
// reconstruct the React Flow graph without losing in-flight state.
//
// Response example:
//
//	{"tasks": {"T1": {"id":"T1","status":"completed",...}, ...}}
func (h *Handler) handleDAGState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	sched := h.manager.Scheduler()
	if sched == nil {
		// Scheduler is offline (crashed). Return empty state — frontend can
		// detect this and show the correct offline UI.
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"tasks": map[string]interface{}{}})
		return
	}

	snap := sched.GetTaskSnapshot()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tasks": snap,
	})
}

// -----------------------------------------------------------------
// GET /api/v1/dags
// -----------------------------------------------------------------
// Returns a list of all submitted DAGs with their task IDs and submission time.
func (h *Handler) handleListDAGs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	dags := h.dagStore.List()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"dags":  dags,
		"count": len(dags),
	})
}

// validateDAG checks that a set of tasks forms a valid DAG:
//   - At least one root node (no dependencies)
//   - No cycles (topological sort must include all nodes)
//   - All referenced dependencies exist in the task set
func validateDAG(tasks []models.Task) error {
	if len(tasks) == 0 {
		return fmt.Errorf("empty task list")
	}

	// Build adjacency and in-degree maps.
	nodes := make(map[string]bool, len(tasks))
	inDegree := make(map[string]int, len(tasks))
	dependents := make(map[string][]string)

	for i := range tasks {
		nodes[tasks[i].ID] = true
		inDegree[tasks[i].ID] = 0
	}

	// Check dependencies exist and build in-degree counts.
	for i := range tasks {
		for _, dep := range tasks[i].Dependencies {
			if !nodes[dep] {
				return fmt.Errorf("task %q depends on unknown task %q", tasks[i].ID, dep)
			}
			inDegree[tasks[i].ID]++
			dependents[dep] = append(dependents[dep], tasks[i].ID)
		}
	}

	// Check for at least one root node.
	hasRoot := false
	var queue []string
	for id, deg := range inDegree {
		if deg == 0 {
			hasRoot = true
			queue = append(queue, id)
		}
	}
	if !hasRoot {
		return fmt.Errorf("DAG has no root nodes (all tasks have dependencies)")
	}

	// Kahn's algorithm: topological sort to detect cycles.
	visited := 0
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		visited++

		for _, dep := range dependents[current] {
			inDegree[dep]--
			if inDegree[dep] == 0 {
				queue = append(queue, dep)
			}
		}
	}

	if visited != len(tasks) {
		return fmt.Errorf("DAG contains a cycle (only %d of %d tasks reachable)", visited, len(tasks))
	}

	return nil
}
