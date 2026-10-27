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
| G-D1-1 SAM smoke-5 | PASS (4/5 direct, 5/5 with tiling) | Root cause of earlier empties found in official docs (dev.meta.ai/docs/sam): instructions return nothing — prompt must be a bare noun phrase + `stream:true`, and zero matches is valid empty output. Concept `spot` @1024: 518→15 (GT 298, dense collapse), 971→99 (130), 349→88 (99), 5206→98 (101), 14581→107 (125). 518 rescued by 2×2 native tiling: 15→240. 349 box P/R/F1 = 0.989/0.879/0.930 @ IoU 0.5. `colony`/`bacterial colony` match nothing — vocabulary matters; `dot` worse (12 on 518) |
| G-D1-2 parser | PASS (real grammar) | `packages/pipeline` parser rewritten to documented wire grammar (`<Nf>id<\|box\|><\|mask\|>`, inclusive corners, base85 masks), fixtures from recorded live stream, 6/6 tests |
| G-D0-2 ratelimit binding | FALLBACK ACTIVE | In-code `rateLimiter.ts` tested (unit + 429 app test). Native binding probe deferred |
| G-D0-3 spend cap | MANUAL | Check Meta console for per-key cap; set + screenshot |
| G-D1-4 scaffold+deploy | PASS | `vite build`, `wrangler deploy`, Pages deploy all green; secret stored |
| G-D4-1 dev-MAE | EXISTS (SAM: 25.1, classical: 39.5) | SAM single-shot `spot` @1024, dev n=19: MAE=25.05, medianAE=7.0. Outliers: 518 dense collapse (283 err; tiled rescue 240, ex-518 MAE≈10.7) and 14684 concept mismatch (`spot`=0 repeatable, `colony dot`=166 overcount vs GT 55 — open tuning). Classical baseline MAE=39.5 (`uv run python eval/classical/count.py`). No Discord question needed — docs resolved it |
| G-EVAL-4 box P/R/F1 | classical ≈ 0 (honest negative) | Same backend scored by `eval/classical/boxscore.py`: micro P=0.011 R=0.009 F1=0.010 @ IoU 0.5 (TP=11 FP=1011 FN=1239). Root cause: colonies sit ~8 gray levels from agar — threshold regions don't coincide with GT. Classical counts are a weak baseline; classical boxes are unusable. Needs SAM (or learned) backend |

## SAM-3.1: resolved via official docs (no Discord question needed)

Earlier empties were my invocation error, not a broken model:
dev.meta.ai/docs/sam/segmenting says commands/instructions "are unreliable and
often return nothing" — the prompt must be a bare noun phrase, the call must
stream (`stream:true`), and zero matches is valid empty output. Bare `spot` +
streaming works (see G-D1-1 above). Concept vocabulary is the tuning axis
(`spot`≫`colony`/`dot` on AGAR plates).

Remaining tuning (dev set, fair game): dense-plate tiling with overlap+dedupe
(518), 14684 concept mismatch. Wonder-boxes fallback not needed.
