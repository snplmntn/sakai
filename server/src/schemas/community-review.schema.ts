import { z } from "zod";

import {
  COMMUNITY_PROPOSAL_TYPES,
  COMMUNITY_REVIEW_STATUSES,
  COMMUNITY_ROUTE_LIFECYCLE_STATUSES
} from "../community/constants.js";
import {
  communityEmptyReviewedChangeSetSchema,
  communityFareUpdateChangeSetSchema,
  communityRouteCreateChangeSetSchema,
  communityRouteUpdateChangeSetSchema,
  communityStopCorrectionChangeSetSchema,
  communityTransferCorrectionChangeSetSchema,
  reviewedChangeSetUnionSchema
} from "../community/review-change-sets.js";

export const reviewQueueFilterSchema = z.object({
  status: z.enum(COMMUNITY_REVIEW_STATUSES).optional(),
  proposalType: z.enum(COMMUNITY_PROPOSAL_TYPES).optional(),
  routeId: z.string().uuid().optional(),
  routeVariantId: z.string().uuid().optional()
});

const promoteCommonSchema = z.object({
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(600).optional(),
  routeId: z.string().uuid().optional(),
  routeVariantId: z.string().uuid().optional(),
  routeCode: z.string().trim().min(1).max(80).optional(),
  routeVariantCode: z.string().trim().min(1).max(120).optional(),
  targetStopIds: z.array(z.string().uuid()).max(12).optional(),
  targetTransferPointIds: z.array(z.string().uuid()).max(12).optional(),
  proposedLifecycleStatus: z.enum(COMMUNITY_ROUTE_LIFECYCLE_STATUSES).optional(),
  evidenceNote: z.string().trim().min(1).max(1200).optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

export const promoteCommunityAnswerSchema = z.discriminatedUnion("proposalType", [
  promoteCommonSchema.extend({
    proposalType: z.literal("route_create"),
    reviewedChangeSet: communityRouteCreateChangeSetSchema
  }),
  promoteCommonSchema.extend({
    proposalType: z.literal("route_update"),
    reviewedChangeSet: communityRouteUpdateChangeSetSchema
  }),
  promoteCommonSchema.extend({
    proposalType: z.literal("route_deprecate"),
    reviewedChangeSet: communityEmptyReviewedChangeSetSchema.optional()
  }),
  promoteCommonSchema.extend({
    proposalType: z.literal("route_reactivate"),
    reviewedChangeSet: communityEmptyReviewedChangeSetSchema.optional()
  }),
  promoteCommonSchema.extend({
    proposalType: z.literal("stop_correction"),
    reviewedChangeSet: communityStopCorrectionChangeSetSchema
  }),
  promoteCommonSchema.extend({
    proposalType: z.literal("transfer_correction"),
    reviewedChangeSet: communityTransferCorrectionChangeSetSchema
  }),
  promoteCommonSchema.extend({
    proposalType: z.literal("fare_update"),
    reviewedChangeSet: communityFareUpdateChangeSetSchema
  }),
  promoteCommonSchema.extend({
    proposalType: z.literal("route_note"),
    reviewedChangeSet: communityEmptyReviewedChangeSetSchema.optional()
  })
]);

export const approveCommunityProposalSchema = z.object({
  reviewNotes: z.string().trim().min(1).max(1200).optional(),
  changeSummary: z.string().trim().min(1).max(240),
  note: z.string().trim().min(1).max(1200).optional(),
  reviewedChangeSet: reviewedChangeSetUnionSchema.optional()
});

export const rejectCommunityProposalSchema = z.object({
  reviewNotes: z.string().trim().min(1).max(1200)
});

export const generateCommunityAiDraftSchema = z.object({
  proposalTypeHint: z.enum(COMMUNITY_PROPOSAL_TYPES).optional(),
  title: z.string().trim().min(1).max(180).optional(),
  summary: z.string().trim().min(1).max(600).optional()
});

export type ReviewQueueFilter = z.infer<typeof reviewQueueFilterSchema>;
export type PromoteCommunityAnswerInput = z.infer<typeof promoteCommunityAnswerSchema>;
export type ApproveCommunityProposalInput = z.infer<typeof approveCommunityProposalSchema>;
export type RejectCommunityProposalInput = z.infer<typeof rejectCommunityProposalSchema>;
export type GenerateCommunityAiDraftInput = z.infer<typeof generateCommunityAiDraftSchema>;
