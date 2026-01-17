import type { Metadata } from "next";

import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Navigation } from "@/components/Navigation";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "OrionScheduler | Crash-Consistent DAG Execution",
  description: "A single-node, crash-consistent DAG execution engine. Submit workflows, break things, and watch the Write-Ahead Log recover your state perfectly.",
  keywords: ["DAG", "Scheduler", "Go", "Next.js", "Write-Ahead Log", "Crash Recovery", "Distributed Systems Concepts"],
  authors: [{ name: "OrionScheduler Demo" }],
  openGraph: {
    title: "OrionScheduler Observatory",
    description: "Submit DAGs. Pull the plug. Watch it recover.",
    type: "website",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark font-sans", inter.variable)}>
      <body className="antialiased min-h-screen bg-background text-foreground pt-16">
        <Navigation />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
