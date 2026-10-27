export interface ParsedDetection {
  /** Stable per-object id within the response (not dense or 0-based). */
  id: number;
  /** Frame index from the <Nf> marker (images always emit frame 0). */
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Confidence c when the request sets include_confidence, else 1. */
  score: number;
  /** Raw mask token payload: `data=H,W,<enc>payload` (base85, height-first). */
  mask?: string;
  /** Source image dimensions reported on every box token. */
  srcW: number;
  srcH: number;
}

// Real SAM-3.1 wire grammar (dev.meta.ai/docs/sam/reading-segmentation):
//   <Nf>id<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..[;c=..]|>
//        <|mask;x=0;y=0[;c=..];data=H,W,<enc>payload|>[,id<|box...|>...]
// Box corners are INCLUSIVE source pixels; mask payload is base85 (not base64).
// `|>` cannot appear inside a payload: '|' (124) is outside the base85 range.
const RECORD_RE =
  /(?:<(\d+)f>|,)(\d+)<\|box;([^|]*)\|><\|mask;x=0;y=0(?:;c=[^;]+)?;data=(\d+),(\d+),([\s\S]*?)\|>/g;

function parseBoxFields(fields: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of fields.split(';')) {
    const [k, v] = part.split('=');
    if (k && v !== undefined && v !== '') {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
  }
  return out;
}

/** Parse all complete records in text (one image = one <0f> line). */
export function parseStreamChunk(chunk: string): ParsedDetection[] {
  const out: ParsedDetection[] = [];
  let frame = 0;
  RECORD_RE.lastIndex = 0;
  for (let m = RECORD_RE.exec(chunk); m !== null; m = RECORD_RE.exec(chunk)) {
    const [, frameMark, id, boxFields, maskH, maskW, payload] = m;
    if (frameMark !== undefined) frame = Number(frameMark);
    const b = parseBoxFields(boxFields);
    if (
      b['x1'] === undefined || b['y1'] === undefined ||
      b['x2'] === undefined || b['y2'] === undefined ||
      b['w'] === undefined || b['h'] === undefined
    ) {
      continue;
    }
    out.push({
      id: Number(id),
      frame,
      x: b['x1'],
      y: b['y1'],
      width: b['x2'] - b['x1'] + 1,
      height: b['y2'] - b['y1'] + 1,
      score: b['c'] ?? 1,
      mask: `data=${maskH},${maskW},${payload}`,
      srcW: b['w'],
      srcH: b['h'],
    });
  }
  return out;
}

/** Incremental parser: emits complete records, buffers a trailing partial. */
export class StreamParser {
  private buf = '';

  push(chunk: string): ParsedDetection[] {
    const text = this.buf + chunk;
    const out: ParsedDetection[] = [];
    let frame = 0;
    let end = 0;
    RECORD_RE.lastIndex = 0;
    for (let m = RECORD_RE.exec(text); m !== null; m = RECORD_RE.exec(text)) {
      // Frame tracking mirrors parseStreamChunk; buffer only holds one line
      // in practice, so recompute per push is fine.
      const [, frameMark, id, boxFields, maskH, maskW, payload] = m;
      if (frameMark !== undefined) frame = Number(frameMark);
      const b = parseBoxFields(boxFields);
      if (
        b['x1'] === undefined || b['y1'] === undefined ||
        b['x2'] === undefined || b['y2'] === undefined ||
        b['w'] === undefined || b['h'] === undefined
      ) {
        continue;
      }
      out.push({
        id: Number(id),
        frame,
        x: b['x1'],
        y: b['y1'],
        width: b['x2'] - b['x1'] + 1,
        height: b['y2'] - b['y1'] + 1,
        score: b['c'] ?? 1,
        mask: `data=${maskH},${maskW},${payload}`,
        srcW: b['w'],
        srcH: b['h'],
      });
      end = m.index + m[0].length;
    }
    this.buf = text.slice(end);
    return out;
  }

  flush(): ParsedDetection[] {
    const rest = this.buf;
    this.buf = '';
    return parseStreamChunk(rest);
  }
}
