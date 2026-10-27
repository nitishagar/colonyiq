import {
  StreamParser,
  dedupeBoxes,
  deterministicCount,
  filterBoxes,
  tileBoxToGlobal,
  type ScoredBox,
  type Tile,
} from '@colonyiq/pipeline';

/** A tile cropped for upload: crop rect + send scale (sent px = crop px × scale). */
export interface SentTile {
  tile: Tile;
  dataUri: string;
  sendScale: number;
}

export interface PlateCount {
  boxes: ScoredBox[];
  count: number;
  maskCount: number;
}

type FetchFn = typeof fetch;

/** Accumulate `response.output_text.delta` payloads from a SAM SSE stream. */
export async function accumulateSSE(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let event = '';
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = done ? '' : (lines.pop() ?? '');
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) {
        if (event === 'response.output_text.delta') {
          try {
            text += (JSON.parse(line.slice(5).trim()) as { delta?: string }).delta ?? '';
          } catch {
            // Ignore malformed delta frames; completed still terminates.
          }
        } else if (event === 'response.completed') {
          reader.cancel().catch(() => undefined);
          return text;
        }
      }
    }
    if (done) return text;
  }
}

/** POST one tile to /api/segment and parse the streamed detections. */
export async function segmentTile(
  apiBase: string,
  dataUri: string,
  fetchFn: FetchFn = fetch,
): Promise<ScoredBox[]> {
  const res = await fetchFn(`${apiBase}/api/segment`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: dataUri }),
  });
  if (!res.ok || !res.body) throw new Error(`segment failed: HTTP ${res.status}`);
  const parser = new StreamParser();
  const text = await accumulateSSE(res.body);
  return [...parser.push(text), ...parser.flush()];
}

/** Segment every tile and map detections to image-global coordinates. */
export async function segmentPlate(
  apiBase: string,
  tiles: SentTile[],
  fetchFn: FetchFn = fetch,
): Promise<ScoredBox[]> {
  const all: ScoredBox[] = [];
  for (const { tile, dataUri, sendScale } of tiles) {
    const dets = await segmentTile(apiBase, dataUri, fetchFn);
    for (const d of dets) {
      // SAM reports boxes in sent-tile px: unscale, then shift by tile origin.
      const global = tileBoxToGlobal(tile, {
        x: d.x / sendScale,
        y: d.y / sendScale,
        width: d.width / sendScale,
        height: d.height / sendScale,
      });
      all.push({ ...global, score: d.score });
    }
  }
  return all;
}

/** Dedupe overlap dupes → filter → deterministic count (LLM never counts). */
export function finalizeCount(boxes: ScoredBox[]): PlateCount {
  const deduped = dedupeBoxes(boxes, 0.5);
  const kept = filterBoxes(deduped, { minArea: 25, minAspect: 0.25, maxAspect: 4 });
  const { count, maskCount } = deterministicCount(kept.length);
  return { boxes: kept, count, maskCount };
}

export interface ReportPayload {
  image: string;
  count: number;
  dilutionFactor?: number;
  platedVolumeMl?: number;
}

/** POST the deterministic count to /api/report and return upstream JSON. */
export async function fetchReport(
  apiBase: string,
  payload: ReportPayload,
  fetchFn: FetchFn = fetch,
): Promise<unknown> {
  const res = await fetchFn(`${apiBase}/api/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`report failed: HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
}
