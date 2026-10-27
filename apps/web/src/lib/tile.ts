import { computeTiles } from '@colonyiq/pipeline';

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
