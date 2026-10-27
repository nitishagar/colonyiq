# ColonyIQ

Every phone, a microbiology lab assistant. Photograph a petri dish and get colonies segmented, counted, and checked in seconds — plus a draft lab report with CFU math.

Live demo: https://colonyiq-web.pages.dev — Demo video: `assets/demos/colonyiq_demo.mp4`

Built with Muse Code for the Meta Global AI Developer Hackathon (Indie track, Push the Frontier).

## Start

```bash
git clone https://github.com/nitishagar/colonyiq.git
cd colonyiq
npm install
npm run test:gates     # offline suite, no keys needed (103 tests)
npm run build --workspace=@colonyiq/web
```

Live API (needs a Meta key, stored as a Worker secret — never in the repo):

```bash
cd apps/api && npx wrangler secret put META_API_KEY
npx wrangler deploy     # https://colonyiq-api.nitishagar.workers.dev
```

## Structure

- `apps/web/` — the phone app (Vite + React): capture/upload, tiling, numbered overlay, report view.
- `apps/api/` — one Cloudflare Worker (Hono): pass-through `/api/segment`, `/api/flag`, `/api/report`. One Meta call per request, response untouched, models pinned server-side.
- `packages/pipeline/` — pure TypeScript shared by app and eval: SAM stream parser, tile/dedupe/filter/count, CFU math.
- `eval/` — the numbers: metrics (MAE, box P/R/F1), dev/test splits, a classical-CV baseline, and `live/STATUS.md` with every gate result.
- `assets/demos/` — the demo video, upload notes, and recording submission details.

## How it works

SAM 3.1 segments every colony zero-shot → classical CV filters → deterministic count → Muse Spark flags suspects and writes the report JSON (it never sets the count — `count = mask count + listed adjustments`, auditable against the overlay).

photos are not stored by ColonyIQ; they are sent to Meta Model API for inference

## Eval (AGAR sample, n=40)

Dev MAE 25.1 (median 7); demo plate box P 0.99 / R 0.88 / F1 0.93; classical baseline MAE 39.5. Dark + vague bins held out for the Nov 2 test run. See `eval/live/STATUS.md`.

## Limits

Colonies <0.5mm and confluent lawns are unreliable; dense plates use the tiled fallback. AGAR bright/734: labels say 78 (54 + 24 Contamination) — we use 78 for IoU. Bright/1399 (`colonies_number`=-1) is excluded pending a docs check.

## Attribution

- AGAR dataset: CC BY-NC 2.0, Majchrowska et al., arXiv:2108.01234 (https://arxiv.org/abs/2108.01234). Representative subset, downscaled for demos. App is free, no paywall.
- Related prior work: Colony Grounded SAM2 (zero-shot colony segmentation).
- Models: SAM 3.1 (segment), Muse Spark `muse-spark-1.2` (flag + report), Muse Image (synthetic eval). Voice: ElevenLabs.
