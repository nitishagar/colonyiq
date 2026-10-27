import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROD_ORIGIN, createApp, isAllowedOrigin } from '../src/index';
import { clearBuckets } from '../src/middleware/rateLimiter';

beforeEach(() => {
  clearBuckets();
  vi.unstubAllGlobals();
});

describe('isAllowedOrigin unit (G-SEC-4)', () => {
  it('allows production, localhost, and branch previews', () => {
    expect(isAllowedOrigin(PROD_ORIGIN)).toBe(true);
    expect(isAllowedOrigin('https://colonyiq-web.pages.dev')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('https://feat-x.colonyiq-web.pages.dev')).toBe(true);
  });

  it('allows the configured ALLOWED_ORIGIN', () => {
    expect(isAllowedOrigin('https://staging.example.com', 'https://staging.example.com')).toBe(true);
  });

  it('blocks evil, lookalike, and downgraded origins', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
    expect(isAllowedOrigin('https://colonyiq-web.pages.dev.evil.com')).toBe(false);
    expect(isAllowedOrigin('https://a.b.colonyiq-web.pages.dev')).toBe(false);
    expect(isAllowedOrigin('http://colonyiq-web.pages.dev')).toBe(false);
    expect(isAllowedOrigin('')).toBe(false);
  });
});

describe('CORS headers on the app (G-SEC-4)', () => {
  const post = (app: ReturnType<typeof createApp>, origin: string) =>
    app.request(
      '/api/segment',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ image: 'data:image/jpeg;base64,AAA' }),
      },
      { ENVIRONMENT: 'test' }, // no key → 500, but CORS headers still apply
    );

  it('echoes an allowed origin', async () => {
    const res = await post(createApp(), 'https://colonyiq-web.pages.dev');
    expect(res.headers.get('access-control-allow-origin')).toBe('https://colonyiq-web.pages.dev');
  });

  it('echoes a branch-preview origin', async () => {
    const res = await post(createApp(), 'https://pr-7.colonyiq-web.pages.dev');
    expect(res.headers.get('access-control-allow-origin')).toBe('https://pr-7.colonyiq-web.pages.dev');
  });

  it('sets no allow-origin for evil.com', async () => {
    const res = await post(createApp(), 'https://evil.com');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
