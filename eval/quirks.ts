/**
 * AGAR ground-truth quirk handling (G-EVAL-8).
 *
 * - bright/734: `colonies_number`=54 excludes 24 Contamination labels; the JSON
 *   carries 78 boxes. Report both, use 78 (the label count) for IoU matching.
 * - bright/1399: `colonies_number`=-1 with zero labels. Tentative TNTC reading,
 *   PENDING the AGAR docs check — never silently scored as a count.
 * - bright/971: filename vs `sample_id`=972 mismatch — always key by filename.
 */

export type GtResolution =
  | { kind: 'count'; count: number; note?: string }
  | { kind: 'tntc-pending-docs'; note: string };

export function resolveGtCount(
  plateId: string,
  coloniesNumber: number,
  labelCount: number,
): GtResolution {
  if (plateId === 'bright/734') {
    return {
      kind: 'count',
      count: labelCount,
      note: `bright/734: colonies_number=${coloniesNumber} excludes Contamination; use ${labelCount} labels for IoU`,
    };
  }
  if (coloniesNumber < 0) {
    return {
      kind: 'tntc-pending-docs',
      note: `${plateId}: colonies_number=${coloniesNumber} is not a count (TNTC reading pending AGAR docs check); exclude from count metrics`,
    };
  }
  return { kind: 'count', count: coloniesNumber };
}

/** Drop pending-docs plates from count metrics; returns the excluded ids. */
export function isCountable(r: GtResolution): r is Extract<GtResolution, { kind: 'count' }> {
  return r.kind === 'count';
}
