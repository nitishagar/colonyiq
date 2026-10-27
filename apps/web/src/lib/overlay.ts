export interface OverlayBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

/** Draw boxes scaled from image pixels to displayed canvas size. */
export function drawBoxes(
  canvas: HTMLCanvasElement,
  displayW: number,
  displayH: number,
  boxes: OverlayBox[],
  naturalW = displayW,
  naturalH = displayH,
): void {
  canvas.width = Math.max(1, Math.round(displayW));
  canvas.height = Math.max(1, Math.round(displayH));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const sx = displayW / naturalW;
  const sy = displayH / naturalH;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;
  for (const b of boxes) {
    ctx.strokeStyle = '#00e676';
    ctx.strokeRect(b.x * sx, b.y * sy, b.width * sx, b.height * sy);
    if (b.label) {
      ctx.fillStyle = '#00e676';
      ctx.font = '12px system-ui';
      ctx.fillText(b.label, b.x * sx + 2, b.y * sy - 2);
    }
  }
}
