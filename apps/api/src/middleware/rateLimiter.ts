/** Sliding-window in-memory rate limiter (fallback if no ratelimit binding). */
const buckets = new Map<string, number[]>();
const WINDOW_MS = 60_000;

export const UNAUTHENTICATED_LIMIT = 30;
export const AUTHENTICATED_LIMIT = 100;

export function checkLimit(key: string, limit: number, now = Date.now()): boolean {
  const cutoff = now - WINDOW_MS;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export function clearBuckets(): void {
  buckets.clear();
}
