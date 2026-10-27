export interface PlateResult {
  plate: string;
  bin: 'bright' | 'dark' | 'vague' | 'lower-res';
  gtCount: number;
  predCount: number;
  latencyMs?: number;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

export interface Metrics {
  n: number;
  /** Mean absolute count error. */
  mae: number;
  /** Median absolute count error. */
  medianAE: number;
  /** Fraction of plates within ±5% of GT (GT=0 counts iff pred=0). */
  within5pct: number;
  /** Latency p50/p95 in ms (over plates that report latency). */
  latencyP50: number | null;
  latencyP95: number | null;
}

export function countMetrics(results: PlateResult[]): Metrics {
  const absErr = results.map((r) => Math.abs(r.predCount - r.gtCount));
  const within = results.filter(
    (r) =>
      r.gtCount === 0 ? r.predCount === 0 : Math.abs(r.predCount - r.gtCount) / r.gtCount <= 0.05,
  ).length;
  const lat = results.map((r) => r.latencyMs).filter((v): v is number => v !== undefined);
  return {
    n: results.length,
    mae: mean(absErr),
    medianAE: median(absErr),
    within5pct: results.length === 0 ? 0 : within / results.length,
    latencyP50: lat.length === 0 ? null : percentile(lat, 50),
    latencyP95: lat.length === 0 ? null : percentile(lat, 95),
  };
}

/** Group metrics by bin for the robustness table (G-EVAL-7). */
export function metricsByBin(results: PlateResult[]): Record<string, Metrics> {
  const out: Record<string, Metrics> = {};
  const grouped = new Map<string, PlateResult[]>();
  for (const r of results) {
    const g = grouped.get(r.bin) ?? [];
    g.push(r);
    grouped.set(r.bin, g);
  }
  for (const [bin, plates] of grouped) out[bin] = countMetrics(plates);
  return out;
}
