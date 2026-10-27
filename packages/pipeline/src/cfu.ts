export interface CfuResult {
  cfuPerMl: number | null;
  /** null cfu when plate is TNTC (too numerous to count). */
  tntc: boolean;
}

/**
 * CFU/mL = count × dilutionFactor / platedVolumeMl.
 * Returns { cfuPerMl: null, tntc: true } when count exceeds maxCountable.
 */
export function cfuPerMl(
  count: number,
  dilutionFactor: number,
  platedVolumeMl: number,
  maxCountable = 1000,
): CfuResult {
  if (!Number.isInteger(count) || count < 0) throw new Error('invalid count');
  if (!(dilutionFactor > 0) || !(platedVolumeMl > 0)) throw new Error('invalid dilution/volume');
  if (count > maxCountable) return { cfuPerMl: null, tntc: true };
  return { cfuPerMl: (count * dilutionFactor) / platedVolumeMl, tntc: false };
}
