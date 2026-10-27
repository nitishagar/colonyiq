const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [, a, b] = m.map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Reject non-https / credentialed / loopback / private egress targets. */
export function assertSafeUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('egress must be https');
  if (url.username || url.password) throw new Error('egress must not carry credentials');
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || isPrivateIPv4(host) || host.endsWith('.local')) {
    throw new Error('egress host blocked');
  }
  return url;
}

export async function safeFetch(
  raw: string,
  init: RequestInit = {},
  timeoutMs = 30_000,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  const url = assertSafeUrl(raw);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetchFn(url.toString(), { ...init, signal: ctrl.signal, redirect: 'manual' });
  } finally {
    clearTimeout(timer);
  }
}
