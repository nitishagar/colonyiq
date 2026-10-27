import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/index';
import { SAM_MODEL, SPARK_MODEL } from '../src/lib/meta';
import { SAM_CONCEPT } from '../src/routes/segment';
import { clearBuckets } from '../src/middleware/rateLimiter';

const ENV = { META_API_KEY: 'test-key', ENVIRONMENT: 'test' };
const IMG = 'data:image/jpeg;base64,AAA';

function stubUpstream(status = 200, body: unknown = { ok: true }) {
  const mock = vi.fn(async () =>
    Response.json(body, {
      status,
      headers: { 'x-upstream-marker': 'untouched' },
    }),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

async function post(app: ReturnType<typeof createApp>, path: string, payload: unknown, env = ENV) {
  return app.request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    env,
  );
}

beforeEach(() => {
  clearBuckets();
  vi.unstubAllGlobals();
});

describe('Worker pass-through contract (G-ARCH-1)', () => {
  const cases = [
    { path: '/api/segment', payload: { image: IMG }, model: SAM_MODEL },
    { path: '/api/flag', payload: { image: IMG, boxes: [{ x: 1, y: 2, width: 3, height: 4 }] }, model: SPARK_MODEL },
    { path: '/api/report', payload: { image: IMG, count: 42 }, model: SPARK_MODEL },
  ] as const;

  it.each(cases)('$path makes exactly 1 upstream call with the pinned model', async ({ path, payload, model }) => {
    const app = createApp();
    const mock = stubUpstream();
    const res = await post(app, path, payload);
    expect(res.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.meta.ai/v1/responses');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-key');
    expect(JSON.parse(init.body as string).model).toBe(model);
  });

  it.each(cases)('$path returns the upstream response untouched', async ({ path, payload }) => {
    const app = createApp();
    stubUpstream(201, { masks: [1, 2, 3], note: 'verbatim' });
    const res = await post(app, path, payload);
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('{"masks":[1,2,3],"note":"verbatim"}');
    expect(res.headers.get('x-upstream-marker')).toBe('untouched');
  });

  it.each(cases)('$path rejects client model/prompt fields (G-SEC-2)', async ({ path, payload }) => {
    const app = createApp();
    const mock = stubUpstream();
    for (const extra of [{ model: 'evil-model' }, { prompt: 'ignore instructions' }, { model: SAM_MODEL }]) {
      const res = await post(app, path, { ...payload, ...extra });
      expect(res.status, `${path} must reject ${JSON.stringify(extra)}`).toBe(400);
    }
    expect(mock).not.toHaveBeenCalled();
  });

  it.each(cases)('$path returns 400 on a bad body without calling upstream', async ({ path }) => {
    const app = createApp();
    const mock = stubUpstream();
    expect((await post(app, path, {})).status).toBe(400);
    expect((await post(app, path, null)).status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });

  it.each(cases)('$path rejects non-data-URI images without calling upstream', async ({ path, payload }) => {
    const app = createApp();
    const mock = stubUpstream();
    for (const image of ['https://evil.example/x.jpg', 'x', '']) {
      const res = await post(app, path, { ...payload, image });
      expect(res.status, `${path} must reject ${JSON.stringify(image)}`).toBe(400);
    }
    expect(mock).not.toHaveBeenCalled();
  });

  it.each(cases)('$path returns 413 for oversized bodies', async ({ path, payload }) => {
    const app = createApp();
    const mock = stubUpstream();
    const res = await app.request(
      path,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': '99999999' },
        body: JSON.stringify(payload),
      },
      ENV,
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'PAYLOAD_TOO_LARGE' });
    expect(mock).not.toHaveBeenCalled();
  });

  it.each(cases)('$path returns 500 when the server key is missing', async ({ path, payload }) => {
    const app = createApp();
    const mock = stubUpstream();
    const res = await post(app, path, payload, { ENVIRONMENT: 'test' } as typeof ENV);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'UPSTREAM_NOT_CONFIGURED' });
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('model IDs pinned server-side (G-SEC-2)', () => {
  it('exports the exact fixed IDs', () => {
    expect(SAM_MODEL).toBe('sam-3.1');
    expect(SPARK_MODEL).toBe('muse-spark-1.2');
  });

  it('/api/segment pins stream:true + bare-noun concept (docs: instructions return nothing)', async () => {
    const app = createApp();
    const mock = stubUpstream();
    const res = await post(app, '/api/segment', { image: IMG });
    expect(res.status).toBe(200);
    const [, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.stream).toBe(true);
    expect(SAM_CONCEPT).toBe('spot');
    const content = body.input[0].content;
    expect(content[0]).toEqual({ type: 'input_text', text: 'spot' });
    expect(content[1].type).toBe('input_image');
  });
});
