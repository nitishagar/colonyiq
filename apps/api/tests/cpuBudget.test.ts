import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * CPU-budget structure (G-PERF-1): the 10ms limit is unenforceable in dev, so
 * the offline gate is structural — routes must stay thin pass-throughs with
 * no loops, no CV, and exactly one upstream call each.
 */
const src = fileURLToPath(new URL('../src/', import.meta.url));
const routes = ['segment.ts', 'flag.ts', 'report.ts'].map((f) => ({
  name: f,
  code: readFileSync(src + `routes/${f}`, 'utf8'),
}));
const meta = readFileSync(src + 'lib/meta.ts', 'utf8');
const egress = readFileSync(src + 'lib/egress.ts', 'utf8');

describe('Worker CPU-budget structure (G-PERF-1 offline)', () => {
  it('each route makes exactly one upstream call (static complement to contract tests)', () => {
    for (const r of routes) {
      const calls = r.code.match(/metaPassThrough\(/g) ?? [];
      expect(calls, r.name).toHaveLength(1);
      expect(r.code).toMatch(/return metaPassThrough\(/);
    }
  });

  it('routes contain no loops or iteration (thin pass-through)', () => {
    const LOOP = /(\bfor\s*\(|\bwhile\s*\(|\bfor\s+await|\bdo\s*\{|\.forEach\s*\(|\.map\s*\()/;
    for (const r of routes) {
      expect(r.code, r.name).not.toMatch(LOOP);
    }
  });

  it('routes carry no model literals or CV (pinned in meta.ts, compute in browser)', () => {
    for (const r of routes) {
      // Identifier imports (SAM_MODEL/SPARK_MODEL) are fine; version literals are not.
      expect(r.code, r.name).not.toMatch(/sam-3\.1|muse-spark-1\.2/);
      expect(r.code, r.name).not.toMatch(/sharp|opencv|onnx|tensorflow/i);
    }
    expect(meta).toMatch(/SAM_MODEL = 'sam-3\.1'/);
    expect(meta).toMatch(/SPARK_MODEL = 'muse-spark-1\.2'/);
  });

  it('upstream egress has a fixed timeout (no unbounded Worker wait)', () => {
    expect(meta).toMatch(/30_000/);
    expect(egress).toMatch(/AbortController/);
    expect(egress).toMatch(/setTimeout/);
  });
});
