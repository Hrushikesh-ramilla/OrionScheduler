import Link from "next/link";
import { Activity, LayoutDashboard, PlaySquare, Component } from "lucide-react";

export function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Activity className="w-5 h-5" />
          </div>
          <span>OrionScheduler</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="/playground" className="hover:text-foreground transition-colors flex items-center gap-2">
            <PlaySquare className="w-4 h-4" />
            Playground
          </Link>
          <Link href="/metrics" className="hover:text-foreground transition-colors flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Metrics
          </Link>
          <Link href="/architecture" className="hover:text-foreground transition-colors flex items-center gap-2">
            <Component className="w-4 h-4" />
            Architecture
          </Link>
        </div>
      </div>
    </nav>
  );
}
