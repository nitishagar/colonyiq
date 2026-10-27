# ColonyIQ

Phone-friendly agar colony counter. Snap a plate, get count + CFU/mL + flags.

Built with Muse Code.

## Problem

Manual colony counting is slow and error-prone. ColonyIQ segments colonies with
SAM-3.1, flags suspicious colonies with Muse Spark, and computes deterministic
counts with CFU/mL math — all from a phone photo.

## Architecture

```
apps/web (Vite + React)  →  tiling, base64, mask decode, CV, count, CFU (browser)
apps/api (Hono Worker)   →  pass-through: /api/segment /api/flag /api/report
packages/pipeline        →  pure-TS: tile, dedupe, filter, count, CFU, SAM parser
eval/                    →  TS driver + metrics, Python tables stub
synth/                   →  synthetic plate stub
```

The Worker makes exactly 1 upstream Meta Model API call per request and returns
the response untouched. Model IDs are pinned server-side (`sam-3.1`,
`muse-spark-1.2`); the client sends no model or prompt.

## Privacy

photos are not stored by ColonyIQ; they are sent to Meta Model API for inference

## Roles

- SAM-3.1: instance segmentation (masks + boxes).
- Muse Spark (`muse-spark-1.2`): colony flagging + report JSON (JSON only, never the count).
- Deterministic pipeline: count = mask count + listed adjustments; CFU/mL math unit-tested.

## How to run

```sh
pnpm install
pnpm -r test          # offline suite, no keys needed
pnpm --filter web dev # web app
cd apps/api && npx wrangler dev src/index.ts  # Worker (local)
```

Secrets (never in repo, never `VITE_*`):

```sh
cd apps/api && npx wrangler secret put META_API_KEY
```

Live tests (needs deployed Worker + secrets):

```sh
COLONYIQ_LIVE=1 pnpm -r test:live
```

## Eval

See `eval/` — MAE, median AE, ±5% rate, box P/R/F1 @ IoU 0.5, latency p50/p95,
split tables (bright/dark/vague/lower-res), ablation (full vs no-CV-filter vs
LLM-count-only). AGAR dev20 (10 lower-res + 10 bright) for tuning; test20
(dark + vague) run once.

## Limits

- Colonies <0.5mm and confluent lawns are unreliable.
- AGAR bright/734: report both 54 (excl. Contamination) and 78; use 78 for IoU.
- AGAR bright/1399 (`colonies_number`=-1): TNTC reading pending AGAR docs check.

## Attribution

- AGAR dataset: CC BY-NC 2.0, Majchrowska et al., arXiv:2108.01234
  (https://arxiv.org/abs/2108.01234). Representative subset downscaled for demos.
- Colony Grounded SAM2 (related prior work on colony segmentation).
- Roles: SAM (segmentation), Spark (flag/report JSON), deterministic code (count/CFU).
