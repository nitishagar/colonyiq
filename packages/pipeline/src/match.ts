import { boxIoU, type ScoredBox } from './dedupe';

export interface PRF1 {
  precision: number;
  recall: number;
  f1: number;
  tp: number;
  fp: number;
  fn: number;
}

/** Greedy box matching at an IoU threshold → P/R/F1 (G-EVAL-4, IoU 0.5). */
export function boxPRF1(
  preds: ScoredBox[],
  groundTruth: ScoredBox[],
  iouThreshold = 0.5,
): PRF1 {
  const matched = new Array<boolean>(groundTruth.length).fill(false);
  let tp = 0;
  const ranked = [...preds].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  for (const p of ranked) {
    let best = -1;
    let bestIoU = iouThreshold;
    for (let i = 0; i < groundTruth.length; i++) {
      if (matched[i]) continue;
      const iou = boxIoU(p, groundTruth[i]);
      if (iou >= bestIoU) {
        bestIoU = iou;
        best = i;
      }
    }
    if (best >= 0) {
      matched[best] = true;
      tp++;
    }
  }
  const fp = preds.length - tp;
  const fn = groundTruth.length - tp;
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, tp, fp, fn };
}
