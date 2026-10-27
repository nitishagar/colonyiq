import { describe, expect, it, vi } from 'vitest';
import {
  accumulateSSE,
  fetchReport,
  finalizeCount,
  segmentPlate,
  segmentTile,
} from '../src/lib/segment';

const REC0 =
  '<0f>0<|box;x1=10;y1=20;x2=19;y2=29;w=100;h=100|><|mask;x=0;y=0;data=2,2,~AB|>';
const REC1 = ',1<|box;x1=30;y1=40;x2=39;y2=49;w=100;h=100|><|mask;x=0;y=0;data=2,2,~CD|>';

function sseBody(frames: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const f of frames) c.enqueue(enc.encode(f));
      c.close();
    },
  });
}

const delta = (text: string) =>
  `event: response.output_text.delta\ndata: ${JSON.stringify({ delta: text })}\n\n`;
const completed = 'event: response.completed\ndata: {}\n\n';

function okFetch(frames: string[]) {
  return vi.fn(async () => new Response(sseBody(frames), { status: 200 }));
}

describe('accumulateSSE', () => {
  it('concatenates deltas until response.completed', async () => {
    const text = await accumulateSSE(sseBody([delta('ab'), delta('cd'), completed]));
    expect(text).toBe('abcd');
  });

  it('returns what arrived when the stream just ends', async () => {
    expect(await accumulateSSE(sseBody([delta('x')]))).toBe('x');
    expect(await accumulateSSE(null)).toBe('');
  });
});

describe('segmentTile (mocked /api/segment SSE)', () => {
  it('POSTs the tile and returns parsed detections', async () => {
    const fetchFn = okFetch([delta(REC0 + REC1), completed]);
    const dets = await segmentTile('https://api.test', 'data:image/jpeg;base64,AAA', fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/api/segment');
    expect(JSON.parse(init.body as string)).toEqual({ image: 'data:image/jpeg;base64,AAA' });
    expect(dets).toHaveLength(2);
    expect(dets[0]).toMatchObject({ x: 10, y: 20, width: 10, height: 10 });
  });

  it('throws on HTTP errors', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));
    await expect(segmentTile('https://api.test', 'data:x', fetchFn)).rejects.toThrow('HTTP 500');
  });
});

describe('segmentPlate + finalizeCount', () => {
  it('maps overlapping tiles to global coords; the shared colony dedupes to one', async () => {
    // Same global colony (190,20,10,10) seen in both tiles at different locals.
    const box = (x1: number) =>
      `<0f>0<|box;x1=${x1};y1=20;x2=${x1 + 9};y2=29;w=200;h=100|><|mask;x=0;y=0;data=2,2,~AB|>`;
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(sseBody([delta(box(190)), completed])))
      .mockResolvedValueOnce(new Response(sseBody([delta(box(100)), completed])));
    const boxes = await segmentPlate(
      'https://api.test',
      [
        { tile: { x: 0, y: 0, width: 200, height: 100, row: 0, col: 0 }, dataUri: 't0', sendScale: 1 },
        { tile: { x: 90, y: 0, width: 200, height: 100, row: 0, col: 1 }, dataUri: 't1', sendScale: 1 },
      ],
      fetchFn,
    );
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toMatchObject({ x: 190, y: 20 });
    expect(boxes[1]).toMatchObject({ x: 190, y: 20 });
    expect(finalizeCount(boxes).count).toBe(1);
  });

  it('unscales boxes sent from downscaled tiles', async () => {
    const fetchFn = okFetch([delta(REC0), completed]);
    const boxes = await segmentPlate(
      'https://api.test',
      [
        {
          tile: { x: 100, y: 50, width: 200, height: 200, row: 0, col: 0 },
          dataUri: 't',
          sendScale: 0.5,
        },
      ],
      fetchFn,
    );
    // Local (10,20,10,10) at 0.5 scale → global (120,90,20,20).
    expect(boxes[0]).toMatchObject({ x: 120, y: 90, width: 20, height: 20 });
  });

  it('zero matches → count 0, and tiny/sliver boxes are filtered', () => {
    expect(finalizeCount([])).toMatchObject({ count: 0, maskCount: 0 });
    const r = finalizeCount([
      { x: 0, y: 0, width: 2, height: 2 }, // area 4 < 25
      { x: 0, y: 0, width: 100, height: 10 }, // aspect 10 > 4
      { x: 0, y: 0, width: 10, height: 10 },
    ]);
    expect(r.count).toBe(1);
  });
});

describe('fetchReport', () => {
  it('POSTs count payload and returns upstream JSON', async () => {
    const fetchFn = vi.fn(async () => Response.json({ cfu_per_ml: 820000 }));
    const out = await fetchReport(
      'https://api.test',
      { image: 'data:x', count: 82, dilutionFactor: 1000, platedVolumeMl: 0.1 },
      fetchFn,
    );
    expect(out).toEqual({ cfu_per_ml: 820000 });
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).count).toBe(82);
  });
});
