# Live-gate results — Oct 27, 2026 (Day 1)

Secrets used: Meta key via `wrangler secret put META_API_KEY` only; Cloudflare
API token via `CLOUDFLARE_API_TOKEN` env only. No key material in this repo.

## Deployments (verified live)

- Worker: `https://colonyiq-api.nitishagar.workers.dev` (wrangler deploy OK)
- Web: `https://colonyiq-web.pages.dev` (HTTP 200, serves app shell)
- `META_API_KEY`: stored as Worker secret (never in repo / `VITE_*`)

## Gate outcomes

| Gate | Result | Evidence |
|---|---|---|
| G-D1-3 key-from-India | PASS | `muse-spark-1.2` text call from India: `OK`, 157 tokens |
| G-D0-1 data-URI | PASS | `input_image.image_url` accepts `data:` URI; `images_processed: 1`, HTTP 200. No Files-API fallback needed |
| Spark vision (flag/report path) | PASS | bright/349 → Spark estimate 82 (GT 99); Wonder 87. Correct ballpark, sees plate |
| /api/report live | PASS | Deployed Worker → Spark JSON: 82×1000/0.1 = `8.2e5 CFU/mL`, math verified |
| /api/flag live | PASS | Deployed Worker → Spark JSON echo of suspect box, HTTP 200 |
| G-D1-1 SAM smoke-5 | BLOCKED | `sam-3.1` returns **empty output** in all 10 invocation variants (plain, explicit box instruction, instructions-field, JSON-schema, function-tool+auto, `detail:high`, `stream:true`). SSE stream has zero `output_text.delta` events. `images_processed: 1`, zero tokens. Chat Completions rejects the model (`Use /v1/responses`). Guessed `image_segmentation` tool rejected as unknown; only `tool_choice:auto` supported |
| G-D0-2 ratelimit binding | FALLBACK ACTIVE | In-code `rateLimiter.ts` tested (unit + 429 app test). Native binding probe deferred |
| G-D0-3 spend cap | MANUAL | Check Meta console for per-key cap; set + screenshot |
| G-D1-4 scaffold+deploy | PASS | `vite build`, `wrangler deploy`, Pages deploy all green; secret stored |
| G-D4-1 dev-MAE | EXISTS (classical baseline) | `eval/classical/count.py` (watershed+contours, spec last-resort): dev n=19 (1399 excluded pending-docs), MAE=39.2, medianAE=31.0. Dense plates collapse (518: 298→~60). Run: `uv run python eval/classical/count.py`. SAM-backend MAE still pending Discord answer |

## SAM-3.1: what to ask in Discord office hours

> `sam-3.1` on `POST /v1/responses` with `input_text` + `input_image` (data URI,
> `images_processed: 1`) returns `completed` with empty `output_text` and zero
> tokens, in every variant tried (instructions, JSON schema, function tool,
> streaming — stream has no delta events). What exact request shape makes
> sam-3.1 emit instance masks or boxes? Is single-image concept segmentation
> supported, or video-only?

Spec fallbacks if SAM stays dark: open-weights SAM on Modal/Baseten, then
classical watershed+contours. Pipeline stays behind the segment interface.
