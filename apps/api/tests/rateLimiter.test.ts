import { beforeEach, describe, expect, it } from 'vitest';
import { AUTHENTICATED_LIMIT, UNAUTHENTICATED_LIMIT, checkLimit, clearBuckets } from '../src/middleware/rateLimiter';

beforeEach(() => clearBuckets());

describe('rateLimiter sliding window (G-SEC-1)', () => {
  it('allows up to the limit then blocks (~12 req/plate fits in 30)', () => {
    expect(UNAUTHENTICATED_LIMIT).toBeGreaterThanOrEqual(12);
    for (let i = 0; i < UNAUTHENTICATED_LIMIT; i++) {
      expect(checkLimit('api:1.2.3.4', UNAUTHENTICATED_LIMIT, 1000 + i)).toBe(true);
    }
    expect(checkLimit('api:1.2.3.4', UNAUTHENTICATED_LIMIT, 2000)).toBe(false);
  });

  it('scopes buckets per key (one IP blocked, another fine)', () => {
    for (let i = 0; i < UNAUTHENTICATED_LIMIT; i++) {
      checkLimit('api:10.0.0.1', UNAUTHENTICATED_LIMIT, 1000 + i);
    }
    expect(checkLimit('api:10.0.0.1', UNAUTHENTICATED_LIMIT, 2000)).toBe(false);
    expect(checkLimit('api:10.0.0.2', UNAUTHENTICATED_LIMIT, 2000)).toBe(true);
  });

  it('slides: old hits expire after the 60s window', () => {
    checkLimit('api:k', 2, 0);
    checkLimit('api:k', 2, 1000);
    expect(checkLimit('api:k', 2, 2000)).toBe(false);
    expect(checkLimit('api:k', 2, 61_000)).toBe(true);
  });

  it('supports a higher authenticated tier', () => {
    expect(AUTHENTICATED_LIMIT).toBeGreaterThan(UNAUTHENTICATED_LIMIT);
    for (let i = 0; i < AUTHENTICATED_LIMIT; i++) {
      checkLimit('api:auth', AUTHENTICATED_LIMIT, 1000 + i);
    }
    expect(checkLimit('api:auth', AUTHENTICATED_LIMIT, 2000)).toBe(false);
  });

  it('clearBuckets resets all state (test isolation)', () => {
    checkLimit('api:z', 1, 1000);
    expect(checkLimit('api:z', 1, 1000)).toBe(false);
    clearBuckets();
    expect(checkLimit('api:z', 1, 1000)).toBe(true);
  });
});
