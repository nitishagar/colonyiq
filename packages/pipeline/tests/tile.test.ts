import { describe, expect, it } from 'vitest';
import { computeTiles, tileBoxToGlobal } from '../src/tile';

describe('computeTiles', () => {
  it('covers the image with the nominal step (tile - overlap)', () => {
    // step=960: x ∈ {0,960,1920}, y ∈ {0,960} → 3 cols × 2 rows.
    const tiles = computeTiles(2048, 1024, 1024, 64);
    expect(tiles).toHaveLength(6);
    // Adjacent tiles start exactly `step` apart, so the overlap band is 64px.
    expect(tiles[1].x - tiles[0].x).toBe(960);
    expect(tiles[3].y - tiles[0].y).toBe(960);
    expect(tiles[0]).toMatchObject({ x: 0, y: 0, width: 1024, height: 1024, row: 0, col: 0 });
    // Trailing slivers are clamped to the image bounds.
    expect(tiles[2]).toMatchObject({ x: 1920, width: 128 });
    expect(tiles[3]).toMatchObject({ y: 960, height: 64 });
  });

  it('clamps edge tiles to the image bounds and covers every pixel', () => {
    const W = 2500;
    const H = 1300;
    const tiles = computeTiles(W, H, 1024, 64);
    for (const t of tiles) {
      expect(t.x + t.width).toBeLessThanOrEqual(W);
      expect(t.y + t.height).toBeLessThanOrEqual(H);
    }
    // Sampled pixels must each fall inside at least one tile.
    for (let y = 0; y < H; y += 37) {
      for (let x = 0; x < W; x += 53) {
        const hit = tiles.some(
          (t) => x >= t.x && x < t.x + t.width && y >= t.y && y < t.y + t.height,
        );
        expect(hit, `pixel ${x},${y} uncovered`).toBe(true);
      }
    }
  });

  it('emits a single clamped tile when the image is smaller than the tile', () => {
    const tiles = computeTiles(800, 600, 1024, 64);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ x: 0, y: 0, width: 800, height: 600 });
  });

  it('rejects invalid geometry', () => {
    expect(() => computeTiles(0, 100)).toThrow();
    expect(() => computeTiles(100, -1)).toThrow();
    expect(() => computeTiles(100, 100, 0)).toThrow();
    expect(() => computeTiles(100, 100, 64, 64)).toThrow('invalid tiling geometry');
    expect(() => computeTiles(100, 100, 64, 100)).toThrow('invalid tiling geometry');
    expect(() => computeTiles(100, 100, 64, -1)).toThrow('invalid tiling geometry');
  });
});

describe('tileBoxToGlobal', () => {
  it('shifts a tile-local box by the tile origin', () => {
    const tile = computeTiles(2048, 1024, 1024, 64)[1]; // x=960
    expect(tileBoxToGlobal(tile, { x: 10, y: 20, width: 30, height: 40 })).toEqual({
      x: 970,
      y: 20,
      width: 30,
      height: 40,
    });
  });
});
