import { Hono } from 'hono';
import { SPARK_MODEL, metaPassThrough, type MetaEnv } from '../lib/meta';
import { FlagRequestSchema } from '../lib/schema';

const flag = new Hono<{ Bindings: MetaEnv }>();

// POST /api/flag — Muse Spark colony-flagging pass-through (JSON only).
flag.post('/', async (c) => {
  const parsed = FlagRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'BAD_REQUEST', issues: parsed.error.issues }, 400);
  return metaPassThrough(c.env, {
    model: SPARK_MODEL,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_image', image_url: parsed.data.image },
          { type: 'input_text', text: `Flag suspicious colonies. Boxes: ${JSON.stringify(parsed.data.boxes ?? [])}. Reply JSON only.` },
        ],
      },
    ],
  });
});

export default flag;
