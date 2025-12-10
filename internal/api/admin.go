package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"go-enterprise-scheduler/internal/engine"
)

// AdminHandler exposes crash simulation and recovery endpoints.
// The HTTP server stays alive — only the scheduler goroutine tree
// is terminated and restarted.
type AdminHandler struct {
	manager   *engine.SchedulerManager
	hub       *Hub
	crashTime time.Time
}

// NewAdminHandler creates an AdminHandler wired to the SchedulerManager.
func NewAdminHandler(manager *engine.SchedulerManager, hub *Hub) *AdminHandler {
	return &AdminHandler{
		manager: manager,
		hub:     hub,
	}
}

// Mux returns an http.Handler with all admin routes registered.
func (a *AdminHandler) Mux() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/admin/simulate-crash", a.handleCrash)
	mux.HandleFunc("/admin/recover", a.handleRecover)
	mux.HandleFunc("/admin/status", a.handleStatus)
	return mux
}

// POST /admin/simulate-crash — kills the scheduler, workers stop.
func (a *AdminHandler) handleCrash(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	if !a.manager.IsRunning() {
		http.Error(w, `{"error":"scheduler is already stopped"}`, http.StatusConflict)
		return
	}

	slog.Info("admin: crash simulation triggered")
	a.manager.SimulateCrash()
	a.crashTime = time.Now()

	// Close all WebSocket connections so clients detect the crash.
	a.hub.CloseAll()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     "crashed",
		"crash_time": a.crashTime,
	})
}

// POST /admin/recover — restarts scheduler from WAL replay.
func (a *AdminHandler) handleRecover(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	if a.manager.IsRunning() {
		http.Error(w, `{"error":"scheduler is already running"}`, http.StatusConflict)
		return
	}

	slog.Info("admin: recovery triggered")
	scheduler := a.manager.Recover()

	// Rewire the WebSocket hub to the new scheduler's event channel.
	go a.hub.Run(scheduler.EventChan)

	recoveryTime := time.Now()
	downtime := recoveryTime.Sub(a.crashTime)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":        "recovered",
		"recovery_time": recoveryTime,
		"downtime_ms":   downtime.Milliseconds(),
	})
}

// GET /admin/status — reports scheduler running state.
func (a *AdminHandler) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	resp := map[string]interface{}{
		"running": a.manager.IsRunning(),
	}
	if !a.crashTime.IsZero() {
		resp["last_crash"] = a.crashTime
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
