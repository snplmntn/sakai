export const COMMUNITY_SUBMISSION_TYPES = [
  "missing_route",
  "route_correction",
  "fare_update",
  "route_note",
  "route_create",
  "route_update",
  "route_deprecate",
  "route_reactivate",
  "stop_correction",
  "transfer_correction"
] as const;

export const LEGACY_COMMUNITY_SUBMISSION_TYPES = [
  "missing_route",
  "route_correction"
] as const;

export const COMMUNITY_PROPOSAL_TYPES = [
  "route_create",
  "route_update",
  "route_deprecate",
  "route_reactivate",
  "stop_correction",
  "transfer_correction",
  "fare_update",
  "route_note"
] as const;

export const COMMUNITY_REVIEW_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "published"
] as const;

export const COMMUNITY_PROPOSAL_SOURCE_KINDS = [
  "direct_submission",
  "promoted_answer"
] as const;

export const COMMUNITY_ANSWER_PROMOTION_STATUSES = [
  "not_reviewed",
  "promoted",
  "published"
] as const;

export const COMMUNITY_ROUTE_LIFECYCLE_STATUSES = [
  "active",
  "deprecated",
  "superseded"
] as const;

export const COMMUNITY_PUBLICATION_ACTIONS = [
  "route_create",
  "route_update",
  "route_deprecate",
  "route_reactivate",
  "stop_correction",
  "transfer_correction",
  "fare_update",
  "route_note"
] as const;

export type CommunitySubmissionType = (typeof COMMUNITY_SUBMISSION_TYPES)[number];
export type LegacyCommunitySubmissionType = (typeof LEGACY_COMMUNITY_SUBMISSION_TYPES)[number];
export type CommunityProposalType = (typeof COMMUNITY_PROPOSAL_TYPES)[number];
export type CommunityReviewStatus = (typeof COMMUNITY_REVIEW_STATUSES)[number];
export type CommunityProposalSourceKind = (typeof COMMUNITY_PROPOSAL_SOURCE_KINDS)[number];
export type CommunityAnswerPromotionStatus =
  (typeof COMMUNITY_ANSWER_PROMOTION_STATUSES)[number];
export type CommunityRouteLifecycleStatus =
  (typeof COMMUNITY_ROUTE_LIFECYCLE_STATUSES)[number];
export type CommunityPublicationAction = (typeof COMMUNITY_PUBLICATION_ACTIONS)[number];

export const mapSubmissionTypeToProposalType = (
  submissionType: CommunitySubmissionType
): CommunityProposalType => {
  if (submissionType === "missing_route") {
    return "route_create";
  }

  if (submissionType === "route_correction") {
    return "route_update";
  }

  return submissionType;
};
