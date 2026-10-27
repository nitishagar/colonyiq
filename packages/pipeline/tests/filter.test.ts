import { describe, expect, it } from 'vitest';
import { filterBoxes } from '../src/filter';

const boxes = [
  { x: 0, y: 0, width: 20, height: 20, score: 0.95 }, // area 400, aspect 1
  { x: 0, y: 0, width: 4, height: 4, score: 0.9 }, // area 16 (dust)
  { x: 0, y: 0, width: 200, height: 200, score: 0.9 }, // area 40000 (agar edge/lawn)
  { x: 0, y: 0, width: 100, height: 5, score: 0.9 }, // aspect 20 (scratch/reflection)
  { x: 0, y: 0, width: 20, height: 20, score: 0.2 }, // low confidence
];

describe('filterBoxes (deterministic CV gates)', () => {
  it('keeps everything by default', () => {
    expect(filterBoxes(boxes)).toHaveLength(5);
  });

  it('applies the score gate', () => {
    expect(filterBoxes(boxes, { minScore: 0.5 })).toHaveLength(4);
  });

  it('applies the area gates (dust vs lawn; scratch passes on area alone)', () => {
    const kept = filterBoxes(boxes, { minArea: 100, maxArea: 10000 });
    // 400 ✓, 16 ✗ dust, 40000 ✗ lawn, 500 ✓ (needs the aspect gate), 400 ✓.
    expect(kept.map((b) => b.width)).toEqual([20, 100, 20]);
  });

  it('applies the aspect-ratio gates (scratches/reflections)', () => {
    const kept = filterBoxes(boxes, { minAspect: 0.5, maxAspect: 2 });
    expect(kept).toHaveLength(4);
    expect(kept.every((b) => b.width / b.height <= 2)).toBe(true);
  });

  it('combines all gates for the colony operating point', () => {
    const kept = filterBoxes(boxes, {
      minScore: 0.5,
      minArea: 100,
      maxArea: 10000,
      minAspect: 0.5,
      maxAspect: 2,
    });
    expect(kept).toHaveLength(1);
    expect(kept[0].score).toBe(0.95);
  });

  it('treats zero-height boxes as infinite aspect (dropped only by a finite maxAspect)', () => {
    const flat = [{ x: 0, y: 0, width: 10, height: 0, score: 1 }];
    expect(filterBoxes(flat)).toHaveLength(1);
    expect(filterBoxes(flat, { maxAspect: 5 })).toHaveLength(0);
  });
});
