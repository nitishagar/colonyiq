import { describe, expect, it } from 'vitest';
import { cfuPerMl } from '../src/cfu';

describe('cfuPerMl (G-CFU-1)', () => {
  it('computes count × dilution / volume', () => {
    expect(cfuPerMl(100, 1000, 0.1)).toEqual({ cfuPerMl: 1_000_000, tntc: false });
    expect(cfuPerMl(30, 100, 1)).toEqual({ cfuPerMl: 3000, tntc: false });
  });

  it('returns 0 CFU/mL for a sterile plate', () => {
    expect(cfuPerMl(0, 1000, 0.1)).toEqual({ cfuPerMl: 0, tntc: false });
  });

  it('flags TNTC (too numerous to count) above maxCountable', () => {
    expect(cfuPerMl(1500, 1000, 0.1)).toEqual({ cfuPerMl: null, tntc: true });
    // Boundary: exactly maxCountable still counts.
    expect(cfuPerMl(1000, 1000, 0.1).tntc).toBe(false);
    expect(cfuPerMl(1001, 1000, 0.1).tntc).toBe(true);
  });

  it('honours a custom maxCountable (dense-plate protocol)', () => {
    expect(cfuPerMl(300, 10, 1, 250)).toEqual({ cfuPerMl: null, tntc: true });
    expect(cfuPerMl(250, 10, 1, 250)).toEqual({ cfuPerMl: 2500, tntc: false });
  });

  it('rejects invalid inputs', () => {
    expect(() => cfuPerMl(-1, 10, 1)).toThrow('invalid count');
    expect(() => cfuPerMl(1.5, 10, 1)).toThrow('invalid count');
    expect(() => cfuPerMl(10, 0, 1)).toThrow('invalid dilution/volume');
    expect(() => cfuPerMl(10, -5, 1)).toThrow('invalid dilution/volume');
    expect(() => cfuPerMl(10, 10, 0)).toThrow('invalid dilution/volume');
    expect(() => cfuPerMl(10, 10, Number.NaN)).toThrow('invalid dilution/volume');
  });
});
