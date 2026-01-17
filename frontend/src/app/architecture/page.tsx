import { Activity, Network, Database, Zap } from "lucide-react";

export default function ArchitecturePage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 max-w-4xl">
      <div className="space-y-4 mb-12 md:mb-16 border-b pb-6 md:pb-8">
        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] md:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-primary/10 text-primary mb-2">
          System Design
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">Architecture & Guarantees</h1>
        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
          OrionScheduler is built to do one thing exceptionally well: execute Directed Acyclic Graphs (DAGs) on a single node with strict crash resilience.
        </p>
      </div>

      <div className="space-y-16 md:space-y-24">
        {/* Placeholder for Commit 77: System Diagram */}
        <section className="space-y-4 md:space-y-6">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight border-b pb-2">System Overview</h2>
          <div className="bg-card w-full border rounded-xl p-8 shadow-sm overflow-x-auto">
            <div className="min-w-[600px] flex flex-col items-center gap-8 font-mono text-sm">
              <div className="flex gap-16 w-full justify-center">
                <div className="border border-primary bg-primary/5 px-6 py-3 rounded text-primary font-bold shadow-sm">
                  User / API Client
                </div>
              </div>
              <div className="w-px h-8 bg-border"></div>
              <div className="flex gap-6 w-full justify-center items-stretch">
                <div className="border border-muted-foreground/30 bg-muted/20 px-6 py-4 rounded text-center shadow-sm w-48 flex flex-col justify-center">
                  <div className="font-bold mb-2">HTTP / WS Handler</div>
                  <div className="text-xs text-muted-foreground whitespace-normal">Ingest DAGs, stream metrics</div>
                </div>
                <div className="w-8 h-px bg-border self-center"></div>
                <div className="border-2 border-emerald-500/50 bg-emerald-500/5 px-6 py-4 rounded text-center shadow-sm w-64">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-2">Core Scheduler</div>
                  <div className="text-xs text-muted-foreground mb-2">Kahn's Algorithm + Gorilla Mux</div>
                  <div className="grid grid-cols-2 gap-2 mt-4 text-[10px]">
                    <div className="border border-border rounded bg-background p-1">Event Loop</div>
                    <div className="border border-border rounded bg-background p-1">Task Queue</div>
                  </div>
                </div>
                <div className="w-8 h-px bg-border self-center"></div>
                <div className="border border-orange-500/50 bg-orange-500/5 px-6 py-4 rounded text-center shadow-sm w-48 space-y-2 flex flex-col justify-center">
                  <div className="font-bold text-orange-600 dark:text-orange-400">Disk WAL</div>
                  <div className="text-[10px] text-muted-foreground bg-background rounded border p-1 break-all">
                    wal/orion.log
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight border-b pb-2">Engineering Constraints</h2>
          <div className="space-y-4">
            <ul className="list-disc pl-6 space-y-4 text-muted-foreground">
              <li>
                <strong className="text-foreground">Strict Consistency over Availability:</strong> In the event of a disk failure writing to the WAL, the scheduler immediately halts (panics). It is safer to drop availability than to lose track of DAG execution state.
              </li>
              <li>
                <strong className="text-foreground">Single-Node Bound:</strong> OrionScheduler is designed to orchestrate processes on a single physical or virtual machine. There is no distributed consensus (Paxos/Raft). This massively reduces complexity and network partition issues.
              </li>
              <li>
                <strong className="text-foreground">Idempotent Recoveries:</strong> The WAL replay mechanism must be able to encounter partially completed graph nodes and safely requeue them without side effects, leaning on the assumption that underlying task commands are themselves idempotent.
              </li>
              <li>
                <strong className="text-foreground">In-Memory Event Bus:</strong> The WebSocket telemetry is driven by a Go channel event bus. To prevent slow WebSocket clients from blocking the core scheduler loop, the event channel must be buffered and non-blocking drops are implemented under backpressure.
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-4 md:space-y-6">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight border-b pb-2">DAG Execution (Kahn's Algorithm)</h2>
          <div className="space-y-4 text-sm md:text-base text-muted-foreground">
            <p>
              The topological sorting of tasks is driven by a modified version of Kahn's Algorithm. When a DAG is submitted:
            </p>
            <ol className="list-decimal pl-5 md:pl-6 space-y-2">
              <li>An adjacency matrix and in-degree count map are computed for all nodes.</li>
              <li>Nodes with an in-degree of <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">0</code> (no dependencies) are immediately pushed into the 'Ready' queue.</li>
              <li>Worker goroutines pull from the 'Ready' queue and execute tasks concurrently.</li>
              <li>Upon success, the scheduler decrements the in-degree of all dependent nodes.</li>
              <li>If a dependent node's in-degree drops to <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">0</code>, it is pushed to the 'Ready' queue.</li>
            </ol>
            <p>
              Cycle detection happens strictly at ingestion time. If the DAG contains a cycle, the topological sort will fail to consume all nodes, and the API will reject the payload with a <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">400 Bad Request</code> before any execution begins.
            </p>
            <div className="bg-[#0D0D0D] p-4 rounded-xl border font-mono text-xs overflow-x-auto text-emerald-400">
<pre>{`// simplified kahn's sort
func (s *Scheduler) validateAndSort(tasks []Task) error {
    inDegree := make(map[string]int)
    for _, t := range tasks {
        for _, dep := range t.Dependencies {
            inDegree[t.ID]++
        }
    }
    // ...
}`}</pre>
            </div>
          </div>
        </section>

        <section className="space-y-4 md:space-y-6">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight border-b pb-2">Crash Recovery via WAL</h2>
          <div className="space-y-4 text-sm md:text-base text-muted-foreground">
            <p>
              The most critical guarantee of OrionScheduler is crash consistency. This is achieved through a Write-Ahead Log (WAL).
            </p>
            <p>
              Before any state change is broadcasted or considered "committed", it is serialized and appended to a persistent disk log (<code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">orion.log</code>). We enforce an <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">fsync</code> before emitting the in-memory event to guarantee durability.
            </p>
            <p>
              The state transitions are:
              <br />
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground mt-2 inline-block">PENDING -&gt; RUNNING -&gt; [COMPLETED | FAILED]</code>
            </p>
            <p>
              On boot, the scheduler checks for the existence of the WAL index. If found, it reads the journal sequentially:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>If a task reaches <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">COMPLETED</code> or <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">FAILED</code>, it is ignored (already terminal).</li>
              <li>If a task was logged as <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">PENDING</code> or <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">RUNNING</code> but lacks a terminal event, it is defined as an <strong>Orphan Target</strong>.</li>
              <li>Orphan targets are forcefully transitioned back to <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">PENDING</code> and pushed back into the 'Ready' queue.</li>
            </ul>
            <div className="bg-[#0D0D0D] p-4 rounded-xl border font-mono text-xs overflow-x-auto text-orange-400">
<pre>{`// wal write procedure
func (w *WAL) Append(entry LogEntry) error {
    data, _ := json.Marshal(entry)
    w.file.Write(append(data, '\\n'))
    return w.file.Sync() // fsync block
}`}</pre>
            </div>
          </div>
        </section>

        {/* WebSocket Telemetry */}
        <section className="space-y-4 md:space-y-6">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight border-b pb-2">Real-time Telemetry (WebSocket)</h2>
          <div className="space-y-4 text-sm md:text-base text-muted-foreground">
            <p>
              Observability is a core feature, built on top of Gorilla WebSockets. Tracking distributed application states is usually delegated to separated monitoring stacks (e.g. Prometheus + Grafana). OrionScheduler ships with built-in instrumentation.
            </p>
            <p>
              When clients connect via <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">/ws</code>, they subscribe to a global event channel. System state is transmitted at 60Hz. If a client drops, fails, or lags, non-blocking channels ensure the scheduler core is never paused. Missing a generic UI broadcast is acceptable; dropping a task execution is not.
            </p>
          </div>
        </section>

        {/* Guarantees */}
        <section className="space-y-4 md:space-y-6">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight border-b pb-2">Delivery Guarantees</h2>
          <div className="space-y-4 text-sm md:text-base text-muted-foreground">
            <p>
              OrionScheduler provides <strong>At-Least-Once</strong> execution guarantees for underlying tasks, and <strong>Exactly-Once</strong> graph completion semantics.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">At-Least-Once (Tasks):</strong> Because tasks can execute externally (e.g. system commands, HTTP calls), a crash immediately after the external action succeeds—but before the WAL logs <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">COMPLETED</code>—will cause that task to be re-run on recovery.
              </li>
              <li>
                <strong className="text-foreground">Exactly-Once (DAG structure):</strong> The graph state machine itself will never transition a child node more than once, and will never mark the overall DAG completed until every node has resolved.
              </li>
            </ul>
          </div>
        </section>

        {/* Performance Trade-offs */}
        <section className="space-y-4 md:space-y-6">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight border-b pb-2">Single Node Trade-offs</h2>
          <div className="space-y-4 text-sm md:text-base text-muted-foreground">
            <p>
              By restricting OrionScheduler to a single machine, we bypass distributed system orchestration taxes (e.g. Paxos consensus, network partition recovery, split-brain). This decision yields extreme performance for the scheduler core.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Pros:</strong> Zero inter-node latency, trivial recovery semantics, low cognitive overhead for operations.
              </li>
              <li>
                <strong className="text-foreground">Cons:</strong> Vulnerable to literal unrecoverable hardware destruction (e.g. disk burns up), limited by the maximum compute power of a single EC2/bare-metal instance.
              </li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  );
}
