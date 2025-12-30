"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, RotateCcw, Activity } from "lucide-react";
import { motion } from "framer-motion";

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
            <Button asChild size="lg" className="rounded-full px-8 h-14 text-base gap-2">
              <Link href="/playground">
                Enter Playground <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-8 h-14 text-base gap-2 bg-background">
              <Link href="/metrics">
                <Activity className="w-5 h-5" /> View Live Metrics
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
