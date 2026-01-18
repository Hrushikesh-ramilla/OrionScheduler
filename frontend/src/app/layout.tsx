import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ORION // Crash-Consistent DAG Scheduler",
  description: "Real-time DAG execution engine with crash-consistent WAL recovery, priority scheduling, and live system observability.",
  keywords: ["DAG", "Scheduler", "Go", "Write-Ahead Log", "Crash Recovery", "Kahn's Algorithm"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased h-screen overflow-hidden bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
