# Interview Defense Sheet

## Why single-node?

Because the project optimizes for correctness, deterministic recovery, and explainability. A single scheduler owns DAG state, so replay behavior is easy to reason about and test.

## Why not distributed?

Distributed scheduling would introduce leader election, split-brain handling, replication, and consensus questions. Those are expensive to implement correctly and would distract from the current project's strongest signal: crash-consistent orchestration.

## Why centralized scheduler?

The scheduler is the serialization point for DAG state transitions. Workers execute tasks, but they do not own dependency state. This keeps dependency release, retry accounting, cascade failure, and replay deterministic.

## What does the WAL guarantee?

The WAL durably records accepted task batches and task lifecycle transitions before scheduler state depends on them. On recovery, completed tasks remain complete, failed tasks remain failed, and in-flight tasks that had started but not completed are treated as orphans and requeued.

## Is this exactly once?

No. The honest guarantee is at-least-once style recovery for in-flight work. A task interrupted during crash can run again after replay. The UI and README explicitly avoid exactly-once claims.

## Retry vs cascade?

An organic worker failure consumes retry budget and can be requeued with backoff. Once retry budget is exhausted, that task permanently fails and downstream dependents are cascade-failed because their prerequisites can no longer be satisfied.

## How is failure handling tested?

Focused tests cover DAG validation, priority ordering, retry replay equivalence, cascade failure accounting, WAL truncation, orphan requeue, and crash/recover lifecycle.

## Biggest engineering challenge?

The hardest part was aligning live execution with WAL replay. Retry counters, failed task accounting, worker completion events, and crash timing must produce the same final state whether they happen live or are reconstructed from disk.

## Key tradeoffs?

The project chooses deterministic recovery over distributed coordination, local WAL over replicated storage, and truthful event-derived UI panels over fake internal dashboards.

## How are public demo controls protected?

Crash/recover endpoints require a demo token when `ADMIN_TOKEN` is set. For the recruiter demo, the Vercel console sends that token as a header so the one public demo can run end-to-end. This is intentionally lightweight demo integrity protection, not a real authentication system.

## What would improve next?

Run one deployed load test, add a small deployment monitor, and keep the scheduler single-node unless there is a real product requirement for distributed coordination.
