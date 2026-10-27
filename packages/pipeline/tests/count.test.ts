import { describe, expect, it } from 'vitest';
import { deterministicCount } from '../src/count';

describe('deterministicCount (G-ARCH-3: count = masks + listed adjustments)', () => {
  it('returns the mask count with no adjustments', () => {
    expect(deterministicCount(42)).toEqual({ count: 42, maskCount: 42, adjustments: [] });
  });

  it('adds listed adjustments (e.g. split merged pair, drop edge artifact)', () => {
    const r = deterministicCount(100, [
      { reason: 'split merged pair', delta: 1 },
      { reason: 'drop edge artifact', delta: -1 },
      { reason: 'split triple', delta: 2 },
    ]);
    expect(r.count).toBe(102);
    expect(r.maskCount).toBe(100);
    expect(r.adjustments).toHaveLength(3);
  });

  it('clamps at zero instead of going negative', () => {
    expect(deterministicCount(2, [{ reason: 'all artifacts', delta: -5 }]).count).toBe(0);
  });

  it('rejects invalid mask counts', () => {
    expect(() => deterministicCount(-1)).toThrow('invalid maskCount');
    expect(() => deterministicCount(1.5)).toThrow('invalid maskCount');
    expect(() => deterministicCount(Number.NaN)).toThrow('invalid maskCount');
  });
});
