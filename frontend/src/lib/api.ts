const configuredApiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
const configuredWsBase = process.env.NEXT_PUBLIC_WS_URL ?? '';
const configuredAdminDemoToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? '';
const allowLocalFallback = process.env.NODE_ENV !== 'production';
const adminTokenStorageKey = 'orion_admin_token';
const isLocalBrowser = () => (
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname)
);

const API_BASE = configuredApiBase || (allowLocalFallback && isLocalBrowser() ? 'http://localhost:8080' : '');
const WS_BASE = configuredWsBase || (allowLocalFallback && isLocalBrowser() ? 'ws://localhost:8080/ws' : '');

export { WS_BASE };

function adminTokenFromBrowser(): string {
  if (typeof window === 'undefined') return '';

  const hash = window.location.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hash);
  const hashToken = hashParams.get('admin_token') ?? hashParams.get('admin');
  if (hashToken) {
    window.localStorage.setItem(adminTokenStorageKey, hashToken);
    return hashToken;
  }

  return window.localStorage.getItem(adminTokenStorageKey) ?? '';
}

export function getAdminDemoToken(): string {
  return configuredAdminDemoToken || adminTokenFromBrowser();
}

export function adminControlsAvailable(): boolean {
  return allowLocalFallback || Boolean(getAdminDemoToken());
}

function adminHeaders(): HeadersInit {
  const token = getAdminDemoToken();
  return token ? { 'X-Orion-Admin-Token': token } : {};
}

function apiUrl(path: string) {
  if (!API_BASE) {
    throw new Error('Backend URL is not configured for this deployment');
  }
  return `${API_BASE}${path}`;
}

// crypto.randomUUID() requires a secure context (HTTPS).
// On localhost (HTTP), fall back to crypto.getRandomValues() which works everywhere.
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 UUID using getRandomValues (works on non-HTTPS localhost)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10).join('')}`;
}

export async function fetchMetrics() {
  const res = await fetch(apiUrl('/api/v1/status'));
  if (!res.ok) throw new Error('Failed to fetch static metrics');
  return res.json();
}

export async function fetchLiveMetrics() {
  const res = await fetch(apiUrl('/api/v1/metrics/live'));
  if (!res.ok) throw new Error('Failed to fetch live metrics');
  return res.json();
}

export async function fetchDags() {
  const res = await fetch(apiUrl('/api/v1/dags'));
  if (!res.ok) throw new Error('Failed to fetch DAGs');
  return res.json();
}

export async function submitDag(tasks: any[]) {
  const res = await fetch(apiUrl('/api/v1/dag'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': generateUUID(),
    },
    body: JSON.stringify(tasks),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to submit DAG');
  }
  return res.json();
}

export async function simulateCrash() {
  const res = await fetch(apiUrl('/admin/simulate-crash'), {
    method: 'POST',
    headers: adminHeaders(),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Crash control requires demo token' : 'Failed to simulate crash');
  }
  return res.json();
}

export async function recoverSystem() {
  const res = await fetch(apiUrl('/admin/recover'), {
    method: 'POST',
    headers: adminHeaders(),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Recovery control requires demo token' : 'Failed to recover system');
  }
  return res.json();
}

export async function fetchDagState(): Promise<{ tasks: Record<string, any> }> {
  const res = await fetch(apiUrl('/api/v1/dag/state'));
  if (!res.ok) throw new Error('Failed to fetch DAG state');
  return res.json();
}

export async function fetchAdminStatus(): Promise<{ running: boolean; last_crash?: string }> {
  const res = await fetch(apiUrl('/admin/status'));
  if (!res.ok) throw new Error('Failed to fetch admin status');
  return res.json();
}
