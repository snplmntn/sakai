import { z } from 'zod';

const submissionTypeSchema = z.enum([
  'missing_route',
  'route_correction',
  'fare_update',
  'route_note',
]);

const missingRoutePayloadSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  knownRideModes: z.array(z.string()).optional(),
  suggestedStops: z.array(z.string()).optional(),
});

const routeCorrectionPayloadSchema = z.object({
  targetRouteOrPlaceId: z.string().min(1),
  incorrectDetail: z.string().min(1),
  proposedCorrection: z.string().min(1),
});

const fareUpdatePayloadSchema = z.object({
  affectedModeOrProduct: z.string().min(1),
  proposedAmount: z.number().positive(),
  passengerType: z.string().optional(),
  note: z.string().optional(),
});

const routeNotePayloadSchema = z.object({
  note: z.string().min(1),
  routeOrArea: z.string().min(1),
});

const baseSchema = z.object({
    title: z.string().min(1).max(280),
    sourceContext: z.record(z.string(), z.unknown()).optional(),
});

export const createCommunitySubmissionSchema = z.discriminatedUnion('submissionType', [
    baseSchema.extend({
        submissionType: z.literal('missing_route'),
        payload: missingRoutePayloadSchema
    }),
    baseSchema.extend({
        submissionType: z.literal('route_correction'),
        payload: routeCorrectionPayloadSchema
    }),
    baseSchema.extend({
        submissionType: z.literal('fare_update'),
        payload: fareUpdatePayloadSchema
    }),
    baseSchema.extend({
        submissionType: z.literal('route_note'),
        payload: routeNotePayloadSchema
    }),
]);

export type CreateCommunitySubmissionInput = z.infer<typeof createCommunitySubmissionSchema>;
