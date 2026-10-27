import { Hono } from 'hono';
import { SAM_MODEL, metaPassThrough, type MetaEnv } from '../lib/meta';
import { SegmentRequestSchema } from '../lib/schema';

const segment = new Hono<{ Bindings: MetaEnv }>();

// POST /api/segment — SAM-3.1 instance segmentation pass-through.
// Concept + streaming pinned server-side per dev.meta.ai/docs/sam/segmenting:
// bare noun phrase (instructions return nothing), stream:true (output arrives
// only as response.output_text.delta events). Client sends image only.
export const SAM_CONCEPT = 'spot';

segment.post('/', async (c) => {
  const parsed = SegmentRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'BAD_REQUEST', issues: parsed.error.issues }, 400);
  return metaPassThrough(c.env, {
    model: SAM_MODEL,
    stream: true,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: SAM_CONCEPT },
          { type: 'input_image', image_url: parsed.data.image },
        ],
      },
    ],
  });
});

export default segment;
