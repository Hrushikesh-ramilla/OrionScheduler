import { Activity, Network, Database, Zap } from "lucide-react";

export default function ArchitecturePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="space-y-4 mb-16 border-b pb-8">
        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-primary/10 text-primary mb-2">
          System Design
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Architecture & Guarantees</h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          OrionScheduler is built to do one thing exceptionally well: execute Directed Acyclic Graphs (DAGs) on a single node with strict crash resilience.
        </p>
      </div>

      <div className="space-y-24">
        {/* Placeholder for Commit 77: System Diagram */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight border-b pb-2">System Overview</h2>
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

        {/* Placeholder for Commit 78: Constraints */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight border-b pb-2">Engineering Constraints</h2>
          <div className="text-muted-foreground italic">[ Constraints Placeholder ]</div>
        </section>

        {/* Placeholder for Commit 79: DAG Logic */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight border-b pb-2">DAG Execution (Kahn's Algorithm)</h2>
          <div className="text-muted-foreground italic">[ DAG Placeholder ]</div>
        </section>

        {/* Placeholder for Commit 80: WAL */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight border-b pb-2">Crash Recovery via WAL</h2>
          <div className="text-muted-foreground italic">[ WAL Placeholder ]</div>
        </section>

      </div>
    </div>
  );
}
