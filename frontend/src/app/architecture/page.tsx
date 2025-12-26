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
          <div className="bg-card w-full h-64 border rounded-xl flex items-center justify-center text-muted-foreground text-sm uppercase tracking-widest">
            [ System Diagram Placeholder ]
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
