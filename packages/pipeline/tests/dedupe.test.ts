import { describe, expect, it } from 'vitest';
import { boxIoU, dedupeBoxes } from '../src/dedupe';

describe('boxIoU', () => {
  it('is 1 for identical boxes and 0 for disjoint boxes', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(boxIoU(a, { ...a })).toBe(1);
    expect(boxIoU(a, { x: 50, y: 50, width: 10, height: 10 })).toBe(0);
  });

  it('computes the exact partial-overlap value', () => {
    // inter 5x5=25, union 100+100-25=175
    expect(boxIoU({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }))
      .toBeCloseTo(25 / 175, 10);
  });

  it('is 0 when either box has zero area', () => {
    expect(boxIoU({ x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(0);
  });
});

describe('dedupeBoxes (overlap-flag NMS across tiles)', () => {
  it('merges the same colony seen in two overlapping tiles, keeping the higher score', () => {
    const kept = dedupeBoxes(
      [
        { x: 100, y: 100, width: 40, height: 40, score: 0.7 }, // tile A view
        { x: 102, y: 101, width: 40, height: 40, score: 0.92 }, // tile B view, same colony
      ],
      0.5,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].score).toBe(0.92);
  });

  it('keeps distinct colonies and touching-but-separate boxes', () => {
    const kept = dedupeBoxes(
      [
        { x: 0, y: 0, width: 20, height: 20, score: 0.9 },
        { x: 100, y: 100, width: 20, height: 20, score: 0.8 },
        { x: 20, y: 0, width: 20, height: 20, score: 0.7 }, // touches first, IoU 0
      ],
      0.5,
    );
    expect(kept).toHaveLength(3);
  });

  it('respects a stricter IoU threshold', () => {
    const boxes = [
      { x: 0, y: 0, width: 10, height: 10, score: 0.9 },
      { x: 5, y: 5, width: 10, height: 10, score: 0.8 }, // IoU 1/7 ≈ 0.143
    ];
    expect(dedupeBoxes(boxes, 0.5)).toHaveLength(2);
    expect(dedupeBoxes(boxes, 0.1)).toHaveLength(1);
  });

  it('handles missing scores and empty input', () => {
    expect(dedupeBoxes([])).toEqual([]);
    expect(dedupeBoxes([{ x: 0, y: 0, width: 5, height: 5 }])).toHaveLength(1);
  });
});
