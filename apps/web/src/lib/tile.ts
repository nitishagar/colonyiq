import { computeQuadrants, computeTiles, type Tile } from '@colonyiq/pipeline';

/** Downscale an image file to a max dimension and return a data: URI tile. */
export async function fileToDataTile(file: File, maxDim = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.9);
}

/** Tiles for the full plate at its natural size (browser-side tiling plan). */
export function planTiles(naturalW: number, naturalH: number, tile = 1024, overlap = 64) {
  return computeTiles(naturalW, naturalH, tile, overlap);
}

/** Dense-plate fallback: 4 overlapping quadrants (validated on AGAR 518). */
export function planQuadrants(naturalW: number, naturalH: number, overlap = 128): Tile[] {
  return computeQuadrants(naturalW, naturalH, overlap);
}

/** Crop one tile from a bitmap and downscale to maxDim; returns data URI + scale. */
export async function cropTileDataUri(
  bitmap: ImageBitmap,
  tile: Tile,
  maxDim = 1024,
): Promise<{ dataUri: string; sendScale: number }> {
  const scale = Math.min(1, maxDim / Math.max(tile.width, tile.height));
  const w = Math.max(1, Math.round(tile.width * scale));
  const h = Math.max(1, Math.round(tile.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas
    .getContext('2d')!
    .drawImage(bitmap, tile.x, tile.y, tile.width, tile.height, 0, 0, w, h);
  return { dataUri: canvas.toDataURL('image/jpeg', 0.85), sendScale: scale };
}
