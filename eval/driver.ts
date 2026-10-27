/**
 * Eval driver (stub). Offline: scores fixture plates with zero network.
 * Live (COLONYIQ_LIVE=1 + COLONYIQ_API_BASE): runs plates via the Worker.
 */
import { countMetrics, metricsByBin, type PlateResult } from './metrics.js';

const OFFLINE_FIXTURES: PlateResult[] = [
  { plate: 'bright/518', bin: 'bright', gtCount: 298, predCount: 295, latencyMs: 1200 },
  { plate: 'bright/349', bin: 'bright', gtCount: 99, predCount: 101, latencyMs: 1100 },
  { plate: 'dark/5206', bin: 'dark', gtCount: 101, predCount: 98, latencyMs: 1300 },
];

async function main(): Promise<void> {
  const live = process.env.COLONYIQ_LIVE === '1';
  if (live && !process.env.COLONYIQ_API_BASE) {
    throw new Error('COLONYIQ_LIVE=1 requires COLONYIQ_API_BASE');
  }
  // Live path (Day4): load splits.json, POST tiles to Worker, collect results.
  const results: PlateResult[] = live ? [] : OFFLINE_FIXTURES;
  if (live) console.warn('live driver not implemented yet (Day4); emitting empty results');
  const summary = { overall: countMetrics(results), byBin: metricsByBin(results), results };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
