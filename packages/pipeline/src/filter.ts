import type { ScoredBox } from './dedupe';

export interface FilterOptions {
  minScore?: number;
  minArea?: number;
  maxArea?: number;
  minAspect?: number;
  maxAspect?: number;
}

/** Deterministic CV filter: score, area, and aspect-ratio gates. */
export function filterBoxes(boxes: ScoredBox[], opts: FilterOptions = {}): ScoredBox[] {
  const {
    minScore = 0,
    minArea = 0,
    maxArea = Number.POSITIVE_INFINITY,
    minAspect = 0,
    maxAspect = Number.POSITIVE_INFINITY,
  } = opts;
  return boxes.filter((b) => {
    if ((b.score ?? 1) < minScore) return false;
    const area = b.width * b.height;
    if (area < minArea || area > maxArea) return false;
    const aspect = b.height === 0 ? Number.POSITIVE_INFINITY : b.width / b.height;
    return aspect >= minAspect && aspect <= maxAspect;
  });
}
