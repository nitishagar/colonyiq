import { describe, expect, it } from 'vitest';
import { planTiles } from '../src/lib/tile';

describe('planTiles (browser tiling plan delegates to the pipeline)', () => {
  it('plans a 3x3 grid for a 2048px plate', () => {
    const tiles = planTiles(2048, 2048);
    expect(tiles).toHaveLength(9);
    expect(tiles[0]).toMatchObject({ x: 0, y: 0, width: 1024, height: 1024 });
  });

  it('honours custom tile/overlap geometry', () => {
    const tiles = planTiles(1000, 500, 512, 12);
    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles[1].x - tiles[0].x).toBe(500);
  });
});
