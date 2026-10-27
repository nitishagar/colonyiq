export interface Tile {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
}

/** Cover a W×H image with overlapping tiles (browser-side tiling plan). */
export function computeTiles(
  imageW: number,
  imageH: number,
  tileSize = 1024,
  overlap = 64,
): Tile[] {
  if (imageW <= 0 || imageH <= 0 || tileSize <= 0 || overlap < 0 || overlap >= tileSize) {
    throw new Error('invalid tiling geometry');
  }
  const tiles: Tile[] = [];
  const step = tileSize - overlap;
  let row = 0;
  for (let y = 0; y < imageH; y += step, row++) {
    let col = 0;
    for (let x = 0; x < imageW; x += step, col++) {
      tiles.push({
        x,
        y,
        width: Math.min(tileSize, imageW - x),
        height: Math.min(tileSize, imageH - y),
        row,
        col,
      });
    }
  }
  return tiles;
}

/**
 * Dense-plate fallback (G-D1-1): split into 4 overlapping quadrants so small
 * colonies render large enough to match. Validated on AGAR 518: 15 → 240.
 */
export function computeQuadrants(imageW: number, imageH: number, overlap = 128): Tile[] {
  if (imageW <= 0 || imageH <= 0 || overlap < 0) throw new Error('invalid tiling geometry');
  const mx = Math.floor(imageW / 2);
  const my = Math.floor(imageH / 2);
  const o = Math.min(overlap, mx, my);
  return [
    { x: 0, y: 0, width: mx + o, height: my + o, row: 0, col: 0 },
    { x: mx - o, y: 0, width: imageW - mx + o, height: my + o, row: 0, col: 1 },
    { x: 0, y: my - o, width: mx + o, height: imageH - my + o, row: 1, col: 0 },
    { x: mx - o, y: my - o, width: imageW - mx + o, height: imageH - my + o, row: 1, col: 1 },
  ];
}

/** Shift a tile-local box to image-global coordinates. */
export function tileBoxToGlobal(
  tile: Tile,
  box: { x: number; y: number; width: number; height: number },
) {
  return { x: box.x + tile.x, y: box.y + tile.y, width: box.width, height: box.height };
}
