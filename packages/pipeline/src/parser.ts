export interface ParsedDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  /** Base64 or RLE mask payload when the stream carries one. */
  mask?: string;
}

// Streamed special-token line format (Day0 placeholder, firmed by live probes):
//   <det> x=12 y=34 w=56 h=78 s=0.91 [mask=...] </det>
const DET_RE =
  /<det>\s*x=(-?\d+(?:\.\d+)?)\s+y=(-?\d+(?:\.\d+)?)\s+w=(\d+(?:\.\d+)?)\s+h=(\d+(?:\.\d+)?)\s+s=(0(?:\.\d+)?|1(?:\.0+)?)\s*(?:mask=([A-Za-z0-9+/=]+)\s*)?<\/det>/;

/** Parse one streamed chunk; returns detections found in complete <det> lines. */
export function parseStreamChunk(chunk: string): ParsedDetection[] {
  const out: ParsedDetection[] = [];
  for (const line of chunk.split('\n')) {
    const m = DET_RE.exec(line.trim());
    if (!m) continue;
    const [, x, y, w, h, s, mask] = m;
    out.push({
      x: Number(x),
      y: Number(y),
      width: Number(w),
      height: Number(h),
      score: Number(s),
      ...(mask ? { mask } : {}),
    });
  }
  return out;
}

/** Incremental parser holding a trailing partial line between chunks. */
export class StreamParser {
  private buf = '';

  push(chunk: string): ParsedDetection[] {
    const text = this.buf + chunk;
    const lines = text.split('\n');
    this.buf = lines.pop() ?? '';
    return parseStreamChunk(lines.join('\n'));
  }

  flush(): ParsedDetection[] {
    const rest = this.buf;
    this.buf = '';
    return parseStreamChunk(rest);
  }
}
