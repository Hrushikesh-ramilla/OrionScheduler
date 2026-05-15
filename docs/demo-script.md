# 90-Second Recruiter Demo Script

## 0-20 Sec: Immediate Wow

Click: open the deployed console and press `AUTO DEMO`.

Say: "This is Orion, a single-node crash-consistent DAG scheduler in Go. The UI is not a mock dashboard: it is connected to the backend over REST and one WebSocket stream. Watch the DAG get accepted, workers pick up tasks, and the event stream show backend task lifecycle events."

Point at: worker pool, observed events, queue depth, and DAG canvas.

## 20-50 Sec: Crash And Recovery

Click: let auto-demo send crash and recovery.

Say: "The crash button stops the scheduler and worker goroutine tree, but the HTTP process and WAL stay alive. On recovery, the scheduler replays the fsync-backed WAL, reconstructs completed and failed tasks, and requeues orphaned in-flight tasks instead of pretending the run never happened."

Point at: scheduler offline banner, recovery event, and worker activity resuming.

## 50-90 Sec: Engineering Maturity

Click: open `GUARANTEES / TRADEOFFS`, then optionally submit a failure-oriented manual DAG.

Say: "I intentionally kept scheduling centralized. That avoids leader election and split-brain complexity while making deterministic replay and correctness easier to defend. The interesting systems work here is DAG validation, priority scheduling, worker concurrency, retry budget handling, cascade failure, WAL replay, and truthful observability."

Close with: "It is not claiming to be Kubernetes or Raft. It is a deeply engineered single-node orchestration demo with clear tradeoffs."
