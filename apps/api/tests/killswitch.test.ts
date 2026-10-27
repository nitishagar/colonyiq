import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/index';
import { KILL_VALUE } from '../src/middleware/killswitch';
import { clearBuckets } from '../src/middleware/rateLimiter';
import { UNAUTHENTICATED_LIMIT } from '../src/middleware/rateLimiter';

beforeEach(() => {
  clearBuckets();
  vi.unstubAllGlobals();
});

describe('killswitch (G-SEC-5)', () => {
  it('closes /api/* with 503 when ENVIRONMENT=disabled', async () => {
    const upstream = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', upstream);
    const app = createApp();
    for (const path of ['/api/segment', '/api/flag', '/api/report']) {
      const res = await app.request(
        path,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: 'data:image/jpeg;base64,AAA', count: 1 }),
        },
        { ENVIRONMENT: KILL_VALUE, META_API_KEY: 'k' },
      );
      expect(res.status, path).toBe(503);
      expect(await res.json()).toEqual({ error: 'SERVICE_DISABLED' });
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it('leaves the health route open when disabled and /api/* open otherwise', async () => {
    const app = createApp();
    const health = await app.request('/', {}, { ENVIRONMENT: KILL_VALUE });
    expect(health.status).toBe(200);
    const ok = await app.request(
      '/api/segment',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: 'data:image/jpeg;base64,AAA' }),
      },
      { ENVIRONMENT: 'dev' }, // enabled (no key → 500, not 503)
    );
    expect(ok.status).toBe(500);
  });
});

describe('per-IP rate limit on the app (G-SEC-1)', () => {
  it('429s with Retry-After after the unauthenticated limit', async () => {
    const app = createApp();
    const headers = { 'content-type': 'application/json', 'CF-Connecting-IP': '9.9.9.9' };
    for (let i = 0; i < UNAUTHENTICATED_LIMIT; i++) {
      const res = await app.request(
        '/api/segment',
        { method: 'POST', headers, body: JSON.stringify({ image: 'data:image/jpeg;base64,AAA' }) },
        { ENVIRONMENT: 'dev' },
      );
      expect(res.status).not.toBe(429);
    }
    const limited = await app.request(
      '/api/segment',
      { method: 'POST', headers, body: JSON.stringify({ image: 'data:image/jpeg;base64,AAA' }) },
      { ENVIRONMENT: 'dev' },
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('60');
    expect(await limited.json()).toEqual({ error: 'RATE_LIMITED' });
  });
});
