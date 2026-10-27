import { Hono } from 'hono';
import { SPARK_MODEL, metaPassThrough, type MetaEnv } from '../lib/meta';
import { ReportRequestSchema } from '../lib/schema';

const report = new Hono<{ Bindings: MetaEnv }>();

// POST /api/report — Muse Spark report-JSON pass-through (JSON only, never the count).
report.post('/', async (c) => {
  const parsed = ReportRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'BAD_REQUEST', issues: parsed.error.issues }, 400);
  const { image, ...rest } = parsed.data;
  return metaPassThrough(c.env, {
    model: SPARK_MODEL,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_image', image_url: image },
          { type: 'input_text', text: `Write the plate report JSON for ${JSON.stringify(rest)}. Reply JSON only.` },
        ],
      },
    ],
  });
});

export default report;
