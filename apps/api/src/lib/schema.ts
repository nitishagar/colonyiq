import { z } from 'zod';

// Client payloads: strict object — model/prompt fields are rejected, never read.
// Images must be data: URIs (what the app sends): the Worker forwards the
// string to Meta untouched, so http(s) URLs would turn our key into a fetch
// proxy. Reject anything else with 400 before any upstream call.
const imagePayload = z
  .object({
    image: z.string().refine((v) => v.startsWith('data:image/'), 'image data: URI required'),
  })
  .strict();

export const SegmentRequestSchema = imagePayload;
export const FlagRequestSchema = imagePayload.extend({
  boxes: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    )
    .optional(),
});
export const ReportRequestSchema = imagePayload.extend({
  count: z.number().int().nonnegative(),
  dilutionFactor: z.number().positive().optional(),
  platedVolumeMl: z.number().positive().optional(),
});

export type SegmentRequest = z.infer<typeof SegmentRequestSchema>;
export type FlagRequest = z.infer<typeof FlagRequestSchema>;
export type ReportRequest = z.infer<typeof ReportRequestSchema>;
