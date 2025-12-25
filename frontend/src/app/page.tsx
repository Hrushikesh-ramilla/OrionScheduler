"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowRight, RotateCcw, Activity, Network, Database } from "lucide-react";
import { motion } from "framer-motion";
import { LiveStats } from "@/components/Landing/LiveStats";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 bg-gradient-to-b from-background to-muted/20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl max-auto space-y-6"
        >
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-secondary text-secondary-foreground mb-4">
            <span className="flex w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            System Online
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Orion<span className="text-primary">Scheduler</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A crash-consistent DAG execution engine. Submit workflows. Break things. Watch it recover.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link 
              href="/playground" 
              className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8 h-14 text-base gap-2")}
            >
              Enter Playground <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="/metrics" 
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full px-8 h-14 text-base gap-2 bg-background")}
            >
              <Activity className="w-5 h-5" /> View Live Metrics
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-card p-8 rounded-2xl border shadow-sm flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Network className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">DAG Execution</h3>
            <p className="text-muted-foreground">Kahn's algorithm-based valid DAG scheduling. Built to handle complex dependencies natively in Go.</p>
          </div>
          
          <div className="bg-card p-8 rounded-2xl border shadow-sm flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Crash Recovery</h3>
            <p className="text-muted-foreground">Disk-backed Write-Ahead Log (WAL) ensures exactly-once execution. Rip the power cord out. It comes back.</p>
          </div>
          
          <div className="bg-card p-8 rounded-2xl border shadow-sm flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Live Observability</h3>
            <p className="text-muted-foreground">Real-time WebSocket telemetry for every single task state transition. Watch the magic happen.</p>
          </div>
        </div>
      </section>

      {/* Live Cluster Stats */}
      <LiveStats />

      {/* Crash Resilience Showcase */}
      <section className="py-24 px-4 bg-muted/30 border-y">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12 text-center md:text-left">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-destructive/10 text-destructive border-destructive/20 mb-2">
              Fault Tolerance
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Zero State Loss. Guaranteed.</h2>
            <p className="text-lg text-muted-foreground">
              OrionScheduler employs an append-only Write-Ahead Log (WAL) that captures all state transitions before they are applied. Hardware failure? Process kill? Node eviction? The system replays the WAL on startup and resumes exactly where it left off.
            </p>
          </div>
          <div className="flex-1 w-full bg-[#0D0D0D] rounded-xl border p-6 font-mono text-xs sm:text-sm text-left shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-destructive via-orange-500 to-emerald-500"></div>
            <div className="space-y-2">
              <p className="text-muted-foreground">$ kill -9 &lt;scheduler_pid&gt;</p>
              <p className="text-destructive font-bold">[FATAL] Process terminated.</p>
              <p className="text-muted-foreground mt-4">$ ./orionscheduler</p>
              <p className="text-emerald-500">[INFO] Recovering WAL from disk...</p>
              <p className="text-emerald-500">[INFO] Replayed 42 events.</p>
              <p className="text-blue-500">[INFO] Resuming DAG execution.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 text-center max-w-3xl mx-auto space-y-8">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Ready to break things?</h2>
        <p className="text-xl text-muted-foreground">
          Drop into the Playground. Submit multiple dependent tasks. Kill the server mid-execution. Watch Kahn's algorithm re-evaluate and the WAL recover lost state.
        </p>
        <Link 
          href="/playground" 
          className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8 h-14 text-base gap-2")}
        >
          Start the Demo <ArrowRight className="w-5 h-5" />
        </Link>
      </section>
    </div>
  );
}
