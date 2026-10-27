import { describe, expect, it } from 'vitest';
import { boxPRF1 } from '@colonyiq/pipeline';
import { countMetrics, metricsByBin, type PlateResult } from '../metrics';
import { isCountable, resolveGtCount } from '../quirks';

/**
 * Tiny AGAR-style fixture (hand-computed expectations below).
 * Abs errors: |295-298|=3, |105-100|=5, |98-101|=3, |30-20|=10.
 */
const TINY_AGAR: PlateResult[] = [
  { plate: 'bright/518', bin: 'bright', gtCount: 298, predCount: 295, latencyMs: 1200 },
  { plate: 'bright/349', bin: 'bright', gtCount: 100, predCount: 105, latencyMs: 1100 },
  { plate: 'dark/5206', bin: 'dark', gtCount: 101, predCount: 98, latencyMs: 1300 },
  { plate: 'vague/11761', bin: 'vague', gtCount: 20, predCount: 30, latencyMs: 1400 },
];

/** Seeded percentile bootstrap for the mean (illustrative on tiny n). */
function bootstrapMeanCI(xs: number[], seed = 42, reps = 2000): { lo: number; hi: number } {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const means: number[] = [];
  for (let r = 0; r < reps; r++) {
    let sum = 0;
    for (let i = 0; i < xs.length; i++) sum += xs[Math.floor(rand() * xs.length)];
    means.push(sum / xs.length);
  }
  means.sort((a, b) => a - b);
  return { lo: means[Math.floor(0.025 * reps)], hi: means[Math.floor(0.975 * reps)] };
}

describe('eval harness on tiny AGAR fixture (G-EVAL-1..4)', () => {
  it('computes MAE / median-AE / ±5% rate (G-EVAL-1..3)', () => {
    const m = countMetrics(TINY_AGAR);
    expect(m.n).toBe(4);
    expect(m.mae).toBeCloseTo(21 / 4, 10); // (3+5+3+10)/4
    expect(m.medianAE).toBe(4); // median of [3,3,5,10]
    // 3/4 within ±5% (105 vs 100 sits exactly on the 5% boundary and counts).
    expect(m.within5pct).toBe(0.75);
  });

  it('reports latency p50/p95 over plates that report latency', () => {
    const m = countMetrics(TINY_AGAR);
    expect(m.latencyP50).toBe(1300);
    expect(m.latencyP95).toBe(1400);
    expect(countMetrics([{ ...TINY_AGAR[0], latencyMs: undefined }]).latencyP50).toBeNull();
  });

  it('builds per-bin robustness tables (G-EVAL-7)', () => {
    const byBin = metricsByBin(TINY_AGAR);
    expect(byBin.bright.mae).toBe(4);
    expect(byBin.dark.mae).toBe(3);
    expect(byBin.vague.mae).toBe(10);
    expect(byBin.bright.n).toBe(2);
  });

  it('scores box P/R/F1 @ IoU 0.5 on a tiny plate (G-EVAL-4)', () => {
    const gt = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 50, y: 50, width: 10, height: 10 },
      { x: 100, y: 100, width: 10, height: 10 },
    ];
    const preds = [
      { x: 0, y: 0, width: 10, height: 10, score: 0.9 },
      { x: 51, y: 50, width: 10, height: 10, score: 0.8 },
      { x: 200, y: 200, width: 10, height: 10, score: 0.7 },
    ];
    const r = boxPRF1(preds, gt, 0.5);
    expect(r).toMatchObject({ tp: 2, fp: 1, fn: 1 });
    expect(r.precision).toBeCloseTo(2 / 3, 10);
    expect(r.recall).toBeCloseTo(2 / 3, 10);
    expect(r.f1).toBeCloseTo(2 / 3, 10);
  });

  it('bootstrap CI brackets the MAE (note: tiny-n CI is illustrative, not powered)', () => {
    const absErr = TINY_AGAR.map((r) => Math.abs(r.predCount - r.gtCount));
    const mae = countMetrics(TINY_AGAR).mae;
    const { lo, hi } = bootstrapMeanCI(absErr);
    expect(lo).toBeLessThanOrEqual(mae);
    expect(hi).toBeGreaterThanOrEqual(mae);
    expect(hi).toBeGreaterThan(lo);
  });

  it('handles AGAR quirks 734/1399 (G-EVAL-8)', () => {
    // 734: 54-vs-78 — use the 78 labels for IoU.
    const q734 = resolveGtCount('bright/734', 54, 78);
    expect(q734).toMatchObject({ kind: 'count', count: 78 });
    // 1399: colonies_number=-1 is pending-docs, excluded from count metrics.
    const q1399 = resolveGtCount('bright/1399', -1, 0);
    expect(q1399.kind).toBe('tntc-pending-docs');
    const plates = [q734, q1399, resolveGtCount('bright/518', 298, 298)];
    const countable = plates.filter(isCountable);
    expect(countable.map((c) => c.count)).toEqual([78, 298]);
  });
});
