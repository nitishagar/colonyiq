import { describe, expect, it } from 'vitest';
import { boxPRF1 } from '../src/match';

describe('boxPRF1 @ IoU 0.5 (G-EVAL-4)', () => {
  it('scores a perfect prediction as P=R=F1=1', () => {
    const gt = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 50, y: 50, width: 10, height: 10 },
    ];
    expect(boxPRF1(structuredClone(gt), gt, 0.5)).toEqual({
      precision: 1,
      recall: 1,
      f1: 1,
      tp: 2,
      fp: 0,
      fn: 0,
    });
  });

  it('counts tp/fp/fn on a mixed tiny plate', () => {
    const gt = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 50, y: 50, width: 10, height: 10 },
      { x: 100, y: 100, width: 10, height: 10 }, // missed
    ];
    const preds = [
      { x: 0, y: 0, width: 10, height: 10, score: 0.9 }, // tp
      { x: 51, y: 50, width: 10, height: 10, score: 0.8 }, // tp (IoU > 0.5)
      { x: 200, y: 200, width: 10, height: 10, score: 0.7 }, // fp
    ];
    const r = boxPRF1(preds, gt, 0.5);
    expect(r.tp).toBe(2);
    expect(r.fp).toBe(1);
    expect(r.fn).toBe(1);
    expect(r.precision).toBeCloseTo(2 / 3, 10);
    expect(r.recall).toBeCloseTo(2 / 3, 10);
    expect(r.f1).toBeCloseTo(2 / 3, 10);
  });

  it('does not match below-threshold overlaps (IoU 1/7 < 0.5)', () => {
    const r = boxPRF1(
      [{ x: 5, y: 5, width: 10, height: 10, score: 0.9 }],
      [{ x: 0, y: 0, width: 10, height: 10 }],
      0.5,
    );
    expect(r).toMatchObject({ tp: 0, fp: 1, fn: 1, precision: 0, recall: 0, f1: 0 });
  });

  it('matches each GT at most once (double detections become fp)', () => {
    const r = boxPRF1(
      [
        { x: 0, y: 0, width: 10, height: 10, score: 0.9 },
        { x: 0, y: 0, width: 10, height: 10, score: 0.8 },
      ],
      [{ x: 0, y: 0, width: 10, height: 10 }],
      0.5,
    );
    expect(r).toMatchObject({ tp: 1, fp: 1, fn: 0 });
  });

  it('handles empty predictions / empty ground truth without NaN', () => {
    const gt = [{ x: 0, y: 0, width: 10, height: 10 }];
    expect(boxPRF1([], gt, 0.5)).toMatchObject({ tp: 0, fp: 0, fn: 1, recall: 0, f1: 0 });
    expect(boxPRF1([], [], 0.5)).toMatchObject({ precision: 1, recall: 1, f1: 1 });
    const noGt = boxPRF1([{ x: 0, y: 0, width: 10, height: 10 }], [], 0.5);
    expect(noGt).toMatchObject({ tp: 0, fp: 1, fn: 0, precision: 0 });
  });
});
