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
