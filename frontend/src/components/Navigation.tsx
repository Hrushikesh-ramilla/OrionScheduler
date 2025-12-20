"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, PlaySquare, Component, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
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
          <Link href="/playground" className={cn("hover:text-foreground transition-colors flex items-center gap-2", pathname === '/playground' && "text-foreground")}>
            <PlaySquare className="w-4 h-4" />
            Playground
          </Link>
          <Link href="/metrics" className={cn("hover:text-foreground transition-colors flex items-center gap-2", pathname === '/metrics' && "text-foreground")}>
            <LayoutDashboard className="w-4 h-4" />
            Metrics
          </Link>
          <Link href="/architecture" className={cn("hover:text-foreground transition-colors flex items-center gap-2", pathname === '/architecture' && "text-foreground")}>
            <Component className="w-4 h-4" />
            Architecture
          </Link>
        </div>
        <button className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {isOpen && (
        <div className="md:hidden border-t bg-background/95 backdrop-blur-md">
          <div className="flex flex-col p-4 gap-4 text-sm font-medium text-muted-foreground">
            <Link href="/playground" onClick={() => setIsOpen(false)} className={cn("hover:text-foreground transition-colors flex items-center gap-2", pathname === '/playground' && "text-foreground")}>
              <PlaySquare className="w-4 h-4" />
              Playground
            </Link>
            <Link href="/metrics" onClick={() => setIsOpen(false)} className={cn("hover:text-foreground transition-colors flex items-center gap-2", pathname === '/metrics' && "text-foreground")}>
              <LayoutDashboard className="w-4 h-4" />
              Metrics
            </Link>
            <Link href="/architecture" onClick={() => setIsOpen(false)} className={cn("hover:text-foreground transition-colors flex items-center gap-2", pathname === '/architecture' && "text-foreground")}>
              <Component className="w-4 h-4" />
              Architecture
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
