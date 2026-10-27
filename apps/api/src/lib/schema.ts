import { z } from 'zod';

// Client payloads: strict object — model/prompt fields are rejected, never read.
const imagePayload = z
  .object({
    image: z.string().min(1, 'image data: URI or URL required'),
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
