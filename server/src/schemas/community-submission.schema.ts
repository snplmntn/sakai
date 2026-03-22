import { z } from 'zod';
import { COMMUNITY_SUBMISSION_TYPES } from '../community/constants.js';

const submissionTypeSchema = z.enum(COMMUNITY_SUBMISSION_TYPES);

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

const routeCreatePayloadSchema = z.object({
  routeCode: z.string().trim().min(1).optional(),
  displayName: z.string().trim().min(1),
  directionLabel: z.string().trim().min(1).optional(),
  origin: z.string().trim().min(1).optional(),
  destination: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).optional(),
});

const routeUpdatePayloadSchema = z.object({
  changedField: z.string().trim().min(1).optional(),
  currentValue: z.string().trim().min(1).optional(),
  proposedValue: z.string().trim().min(1),
  note: z.string().trim().min(1).optional(),
});

const routeLifecyclePayloadSchema = z.object({
  reason: z.string().trim().min(1),
  replacementRouteCode: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).optional(),
});

const stopCorrectionPayloadSchema = z.object({
  stopId: z.string().uuid().optional(),
  stopName: z.string().trim().min(1).optional(),
  correctedName: z.string().trim().min(1).optional(),
  correctedArea: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).optional(),
});

const transferCorrectionPayloadSchema = z.object({
  transferPointId: z.string().uuid().optional(),
  fromStopId: z.string().uuid().optional(),
  toStopId: z.string().uuid().optional(),
  correctedWalkingDistanceM: z.number().int().positive().optional(),
  correctedWalkingDurationMinutes: z.number().int().positive().optional(),
  note: z.string().trim().min(1).optional(),
});

const baseSchema = z.object({
    title: z.string().min(1).max(280),
    sourceContext: z.record(z.string(), z.unknown()).optional(),
    routeId: z.string().uuid().optional(),
    routeVariantId: z.string().uuid().optional(),
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
    baseSchema.extend({
        submissionType: z.literal('route_create'),
        payload: routeCreatePayloadSchema
    }),
    baseSchema.extend({
        submissionType: z.literal('route_update'),
        payload: routeUpdatePayloadSchema
    }),
    baseSchema.extend({
        submissionType: z.literal('route_deprecate'),
        payload: routeLifecyclePayloadSchema
    }),
    baseSchema.extend({
        submissionType: z.literal('route_reactivate'),
        payload: routeLifecyclePayloadSchema
    }),
    baseSchema.extend({
        submissionType: z.literal('stop_correction'),
        payload: stopCorrectionPayloadSchema
    }),
    baseSchema.extend({
        submissionType: z.literal('transfer_correction'),
        payload: transferCorrectionPayloadSchema
    }),
]);

export type CreateCommunitySubmissionInput = z.infer<typeof createCommunitySubmissionSchema>;
