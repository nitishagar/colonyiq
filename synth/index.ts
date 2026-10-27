/** Synthetic plate generator stub (Day2-3): random disks + boxes for offline tests. */
export interface SynthPlate {
  width: number;
  height: number;
  boxes: { x: number; y: number; width: number; height: number }[];
}

export function synthPlate(count: number, width = 512, height = 512, seed = 1): SynthPlate {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const boxes = [];
  for (let i = 0; i < count; i++) {
    const d = 8 + rand() * 24;
    boxes.push({
      x: rand() * (width - d),
      y: rand() * (height - d),
      width: d,
      height: d,
    });
  }
  return { width, height, boxes };
}
