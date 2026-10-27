export interface ScoredBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number;
}

export function boxIoU(a: ScoredBox, b: ScoredBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union <= 0 ? 0 : inter / union;
}

/** Greedy NMS dedupe across overlapping tiles (highest score wins). */
export function dedupeBoxes(boxes: ScoredBox[], iouThreshold = 0.5): ScoredBox[] {
  const sorted = [...boxes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const kept: ScoredBox[] = [];
  for (const box of sorted) {
    if (kept.every((k) => boxIoU(k, box) < iouThreshold)) kept.push(box);
  }
  return kept;
}
