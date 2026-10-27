export interface CountAdjustment {
  reason: string;
  delta: number;
}

export interface CountResult {
  count: number;
  maskCount: number;
  adjustments: CountAdjustment[];
}

/**
 * Deterministic count: mask count + listed adjustments (G-ARCH-3).
 * The LLM never sets the count; it only supplies report JSON.
 */
export function deterministicCount(
  maskCount: number,
  adjustments: CountAdjustment[] = [],
): CountResult {
  if (!Number.isInteger(maskCount) || maskCount < 0) throw new Error('invalid maskCount');
  const delta = adjustments.reduce((s, a) => s + a.delta, 0);
  const count = Math.max(0, maskCount + delta);
  return { count, maskCount, adjustments };
}
