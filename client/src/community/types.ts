import type { PassengerType, RoutePreference } from '../routes/types';
import type { CommunityProposalType, CommunityReviewedChangeSet } from './review-change-set-types';

export type { CommunityProposalType, CommunityReviewedChangeSet } from './review-change-set-types';

export type CommunitySubmissionType =
  | 'missing_route'
  | 'route_correction'
  | 'fare_update'
  | 'route_note'
  | 'route_create'
  | 'route_update'
  | 'route_deprecate'
  | 'route_reactivate'
  | 'stop_correction'
  | 'transfer_correction';

export type CommunitySubmissionStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'published';
export type CommunityProposalSourceKind = 'direct_submission' | 'promoted_answer';
export type CommunityAnswerPromotionStatus = 'not_reviewed' | 'promoted' | 'published';
export type CommunityAiConfidence = 'high' | 'medium' | 'low';

export interface CommunitySubmission {
  id: string;
  userId: string;
  submissionType: CommunitySubmissionType;
  status: CommunitySubmissionStatus;
  title: string;
  payload: Record<string, unknown>;
  sourceContext: Record<string, unknown> | null;
  routeId?: string | null;
  routeVariantId?: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityQuestion {
  id: string;
  userId: string;
  title: string;
  body: string;
  originLabel: string;
  destinationLabel: string;
  originPlaceId: string | null;
  destinationPlaceId: string | null;
  routeQueryText: string | null;
  preference: RoutePreference | null;
  passengerType: PassengerType | null;
  sourceContext: Record<string, unknown> | null;
  replyCount: number;
  lastAnsweredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityQuestionAnswer {
  id: string;
  questionId: string;
  userId: string;
  body: string;
  helpfulCount: number;
  promotionStatus: CommunityAnswerPromotionStatus;
  linkedRouteId: string | null;
  linkedRouteVariantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityQuestionDetail {
  question: CommunityQuestion;
  answers: CommunityQuestionAnswer[];
}

export interface CommunityReviewProposal {
  id: string;
  sourceKind: CommunityProposalSourceKind;
  sourceSubmissionId: string | null;
  sourceQuestionId: string | null;
  sourceAnswerId: string | null;
  createdByUserId: string;
  proposalType: CommunityProposalType;
  reviewStatus: CommunitySubmissionStatus;
  title: string;
  summary: string | null;
  routeId: string | null;
  routeVariantId: string | null;
  targetStopIds: string[];
  targetTransferPointIds: string[];
  proposedLifecycleStatus: 'active' | 'deprecated' | 'superseded' | null;
  payload: Record<string, unknown>;
  reviewedChangeSet: CommunityReviewedChangeSet;
  evidenceNote: string | null;
  reviewNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  routeLabel: string | null;
  routeVariantLabel: string | null;
  sourceSubmissionTitle: string | null;
  sourceQuestionTitle: string | null;
  sourceAnswerPreview: string | null;
  aiConfidence: CommunityAiConfidence | null;
  relatedProposalCount: number;
}

export interface CommunityReviewProposalDetail extends CommunityReviewProposal {
  sourceSubmission: {
    id: string;
    submissionType: CommunitySubmissionType;
    title: string;
    payload: Record<string, unknown>;
    sourceContext: Record<string, unknown> | null;
    status: CommunitySubmissionStatus;
  } | null;
  sourceQuestion: {
    id: string;
    title: string;
    body: string;
    originLabel: string;
    destinationLabel: string;
  } | null;
  sourceAnswer: {
    id: string;
    body: string;
    helpfulCount: number;
    promotionStatus: CommunityAnswerPromotionStatus;
  } | null;
  aiSuggestion: CommunityReviewAiSuggestion | null;
}

export interface CommunityReviewAiSuggestion {
  id: string;
  modelName: string;
  confidence: CommunityAiConfidence;
  duplicateKey: string | null;
  suggestedProposalType: CommunityProposalType;
  reason: string;
  title: string;
  summary: string | null;
  changeSummary: string;
  reviewNotes: string;
  note: string | null;
  routeCode: string | null;
  routeVariantCode: string | null;
  proposedLifecycleStatus: 'active' | 'deprecated' | 'superseded' | null;
  reviewedChangeSet: CommunityReviewedChangeSet;
  createdAt: string;
}

export interface CommunityLaunchDraft {
  defaultMode?: 'question' | 'submission';
  title?: string;
  body?: string;
  originLabel?: string;
  destinationLabel?: string;
  originPlaceId?: string;
  destinationPlaceId?: string;
  routeQueryText?: string;
  preference?: RoutePreference;
  passengerType?: PassengerType;
  sourceContext?: Record<string, unknown>;
  routeId?: string;
}
