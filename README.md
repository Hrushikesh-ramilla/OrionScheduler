# OrionScheduler

A single-node, crash-consistent Distributed System / DAG execution engine built in Go.

![OrionScheduler Landing](/frontend/public/landing.png)

## What is this?
OrionScheduler is a high-performance orchestration layer. It receives Directed Acyclic Graphs (DAGs) of tasks, computes topological order via Kahn's algorithm, and evaluates concurrency via worker pools.

Most importantly, it solves **Crash Consistency** through an append-only **Write-Ahead Log (WAL)**.

This is a production-grade demonstration of distributed systems concepts (idempotency, durability, backpressure, topological execution) built completely from scratch without external dependencies like Kafka or Redis.

## Features
- **Crash Recovery Simulator**: Pull the plug on the server mid-execution. Watch Kahn's algorithm re-evaluate and the WAL recover lost state instantly.
- **Topological DAG Sorting**: Native cycle detection and valid topological execution logic.
- **Real-Time Telemetry**: Gorilla WebSockets streams 60Hz metrics directly from the execution engine to the UI without blocking core worker pools.
- **At-Least-Once Constraints**: Idempotent target reruns on partial failures.
- **Fullstack Observatory**: Built with Next.js 14, Framer Motion, and Recharts.

## Getting Started

### Backend
1. Clone the repository.
2. Run the Go server:
   ```bash
   go run cmd/server/main.go
   ```
3. The server starts on `:8080`

### Frontend (Observatory)
1. Navigate to the `frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the UI:
   ```bash
   npm run dev
   ```

### Seeding Metrics
To generate initial metrics for the dashboard charts, run the provided seeder script:
```bash
go run scripts/seed.go
```

## Demo Guide (The "Pull the Plug" test)
The system is designed to be destroyed and revived.
1. Open the UI to `/playground`.
2. Configure a complex DAG using a provided Template.
3. Submit the graph.
4. While tasks are running, click the **Pull the Plug** explicit crash button.
5. The backend process instantly FATAL panics, terminating midway through execution.
6. Click **Recover System**.
7. The WAL is replayed, orphan targets are requeued, and execution effortlessly resumes securely.

## Built With
- **Backend:** Go 1.21, Gorilla Mux/WebSockets
- **Frontend:** Next.js 14, TailwindCSS, Framer Motion, Recharts, React Flow

## License
MIT
