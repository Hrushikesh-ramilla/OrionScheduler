package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"go-enterprise-scheduler/internal/api"
	"go-enterprise-scheduler/internal/engine"
	"go-enterprise-scheduler/internal/storage"
)

func main() {
	slog.Info("=== Distributed Task Orchestrator ===")
	slog.Info("Starting up...")

	// Initialize WAL
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

	// Initialize scheduler
	scheduler := engine.NewScheduler()
	slog.Info("DAG scheduler initialized")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	scheduler.Start(ctx)
	slog.Info("DAG scheduler event loop started")

	// Start workers
	dispatcher := engine.NewDispatcher(scheduler, engine.DefaultWorkerCount)
	dispatcher.Start(ctx)
	slog.Info("dispatcher started", "workers", engine.DefaultWorkerCount)

	// HTTP server
	handler := api.NewHandler(scheduler)
	server := &http.Server{
		Addr:         ":8080",
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("HTTP server listening", "port", 8080)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
			os.Exit(1)
		}
	}()

	// Block forever for now
	select {}
}
