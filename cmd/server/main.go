// Distributed Task Orchestrator — main.go
//
// This is the entry point for the go-enterprise-scheduler server.
// It wires together the storage layer (WAL), the DAG scheduling engine,
// the worker pool dispatcher, and the REST API, then starts the HTTP
// server on port 8080 with graceful shutdown support.
//
// The SchedulerManager abstraction allows the scheduler to be stopped
// and restarted (crash simulation + WAL recovery) while the HTTP server
// stays alive.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"go-enterprise-scheduler/internal/api"
	"go-enterprise-scheduler/internal/engine"
	"go-enterprise-scheduler/internal/storage"
)

func main() {
	slog.Info("=== OrionScheduler ===")
	slog.Info("starting up...")

	// -----------------------------------------------------------------
	// 1. Initialize the Write-Ahead Log for crash recovery.
	// -----------------------------------------------------------------
	walPath := os.Getenv("WAL_PATH")
	if walPath == "" {
		walPath = "wal.json"
	}
	wal, err := storage.NewWAL(walPath)
	if err != nil {
		slog.Error("failed to initialize WAL", "error", err)
		os.Exit(1)
	}
	defer wal.Close()
	slog.Info("WAL initialized", "file", walPath)

	// -----------------------------------------------------------------
	// 2. Determine worker count from env or default.
	// -----------------------------------------------------------------
	workerCount := engine.DefaultWorkerCount
	if wc := os.Getenv("WORKER_COUNT"); wc != "" {
		if n, err := strconv.Atoi(wc); err == nil && n > 0 {
			workerCount = n
		}
	}

	// -----------------------------------------------------------------
	// 3. Start the scheduler via the SchedulerManager.
	//    This creates the scheduler, replays the WAL, and starts
	//    the dispatch loop + worker pool.
	// -----------------------------------------------------------------
	manager := engine.NewSchedulerManager(wal, workerCount)
	scheduler := manager.Start()

	// -----------------------------------------------------------------
	// 4. Set up the WebSocket hub for real-time event broadcasting.
	// -----------------------------------------------------------------
	wsHub := api.NewHub()
	go wsHub.Run(scheduler.EventChan)
	slog.Info("WebSocket hub started")

	// -----------------------------------------------------------------
	// 5. Configure the HTTP server with all API routes.
	// -----------------------------------------------------------------
	idemStore := api.NewIdempotencyStore()
	handler := api.NewHandler(scheduler, wal, idemStore, wsHub)

	// Register admin endpoints (crash/recover) on the same mux.
	// We need access to the underlying mux — for now, create admin
	// handler separately and it registers on NewHandler's mux.
	adminHandler := api.NewAdminHandler(manager, wsHub)

	// Build a top-level mux that delegates to both API and admin.
	rootMux := http.NewServeMux()
	rootMux.Handle("/admin/", adminHandler.Mux())
	rootMux.Handle("/", handler)

	server := &http.Server{
		Addr:         ":8080",
		Handler:      rootMux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Run the HTTP server in a separate goroutine.
	go func() {
		slog.Info("HTTP server listening", "port", 8080)
		slog.Info("POST /api/v1/dag     -> Submit a task DAG")
		slog.Info("GET  /api/v1/status   -> System metrics")
		slog.Info("GET  /api/v1/metrics/live -> Live metrics (JSON)")
		slog.Info("GET  /ws              -> WebSocket events")
		slog.Info("POST /admin/simulate-crash -> Crash simulation")
		slog.Info("POST /admin/recover   -> WAL recovery")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
			os.Exit(1)
		}
	}()

	// -----------------------------------------------------------------
	// 6. Graceful shutdown: wait for SIGINT or SIGTERM.
	// -----------------------------------------------------------------
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("received signal, initiating graceful shutdown", "signal", sig)

	// Stop accepting new HTTP connections.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server forced shutdown", "error", err)
	} else {
		slog.Info("HTTP server stopped gracefully")
	}

	// Stop the scheduler + workers.
	manager.SimulateCrash()

	slog.Info("all systems stopped. Goodbye.")
}
