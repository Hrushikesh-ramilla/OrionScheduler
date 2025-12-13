export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold tracking-tight mb-4 text-center mt-20">OrionScheduler</h1>
      <p className="text-muted-foreground text-center text-lg max-w-2xl mx-auto">
        A crash-consistent DAG execution engine. Submit workflows. Break things. Watch it recover.
      </p>
    </div>
  );
}
