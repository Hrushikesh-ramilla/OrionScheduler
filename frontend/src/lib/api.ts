const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export async function fetchMetrics() {
  const res = await fetch(`${API_BASE}/api/v1/status`);
  if (!res.ok) throw new Error('Failed to fetch static metrics');
  return res.json();
}

export async function fetchLiveMetrics() {
  const res = await fetch(`${API_BASE}/api/v1/metrics/live`);
  if (!res.ok) throw new Error('Failed to fetch live metrics');
  return res.json();
}

export async function fetchDags() {
  const res = await fetch(`${API_BASE}/api/v1/dags`);
  if (!res.ok) throw new Error('Failed to fetch DAGs');
  return res.json();
}

export async function submitDag(tasks: any[]) {
  const res = await fetch(`${API_BASE}/api/v1/dag`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(tasks),
  });
  if (!res.ok) throw new Error('Failed to submit DAG');
  return res.ok;
}

export async function simulateCrash() {
  const res = await fetch(`${API_BASE}/admin/simulate-crash`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to simulate crash');
  return res.json();
}

export async function recoverSystem() {
  const res = await fetch(`${API_BASE}/admin/recover`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to recover system');
  return res.json();
}
