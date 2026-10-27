import { Hono } from 'hono';
import { SAM_MODEL, metaPassThrough, type MetaEnv } from '../lib/meta';
import { SegmentRequestSchema } from '../lib/schema';

const segment = new Hono<{ Bindings: MetaEnv }>();

// POST /api/segment — SAM-3.1 instance segmentation pass-through.
segment.post('/', async (c) => {
  const parsed = SegmentRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'BAD_REQUEST', issues: parsed.error.issues }, 400);
  return metaPassThrough(c.env, {
    model: SAM_MODEL,
    input: [{ role: 'user', content: [{ type: 'input_image', image_url: parsed.data.image }] }],
  });
});

export default segment;
