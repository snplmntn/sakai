import { z } from "zod";

import { generateCommunityReviewAiDraft } from "../ai/community-review-assistant.js";
import { getSupabaseAdminClient } from "../config/supabase.js";
import {
  COMMUNITY_PROPOSAL_TYPES,
  COMMUNITY_REVIEW_STATUSES,
  COMMUNITY_ROUTE_LIFECYCLE_STATUSES,
  mapSubmissionTypeToProposalType
} from "../community/constants.js";
import { parseReviewedChangeSetForProposalType } from "../community/review-change-sets.js";
import type {
  ApproveCommunityProposalInput,
  PromoteCommunityAnswerInput,
  RejectCommunityProposalInput,
  ReviewQueueFilter
} from "../schemas/community-review.schema.js";
import type { Database } from "../types/database.js";
import { HttpError } from "../types/http-error.js";
import type {
  RouteCommunityMetadata,
  RouteCommunityNote,
  RouteCommunityUpdate
} from "../types/route-query.js";

type ProposalRow = Database["public"]["Tables"]["community_route_learning_proposals"]["Row"];
type ProposalInsert = Database["public"]["Tables"]["community_route_learning_proposals"]["Insert"];
type ProposalUpdate = Database["public"]["Tables"]["community_route_learning_proposals"]["Update"];
type PublicationRow = Database["public"]["Tables"]["community_route_publications"]["Row"];
type RouteNoteRow = Database["public"]["Tables"]["community_route_notes"]["Row"];
type ProposalAiSuggestionRow = Database["public"]["Tables"]["community_route_ai_suggestions"]["Row"];
type QuestionRow = Database["public"]["Tables"]["community_questions"]["Row"];
type AnswerRow = Database["public"]["Tables"]["community_question_answers"]["Row"];
type SubmissionRow = Database["public"]["Tables"]["community_submissions"]["Row"];
type RouteRow = Database["public"]["Tables"]["routes"]["Row"];
type RouteVariantRow = Database["public"]["Tables"]["route_variants"]["Row"];

interface ProposalSourceSummary {
  submission: SubmissionRow | null;
  question: QuestionRow | null;
  answer: AnswerRow | null;
}

export interface CommunityRouteLearningProposal {
  id: string;
  sourceKind: ProposalRow["source_kind"];
  sourceSubmissionId: string | null;
  sourceQuestionId: string | null;
  sourceAnswerId: string | null;
  createdByUserId: string;
  proposalType: ProposalRow["proposal_type"];
  reviewStatus: ProposalRow["review_status"];
  title: string;
  summary: string | null;
  routeId: string | null;
  routeVariantId: string | null;
  targetStopIds: string[];
  targetTransferPointIds: string[];
  proposedLifecycleStatus: ProposalRow["proposed_lifecycle_status"];
  payload: Record<string, unknown>;
  reviewedChangeSet: Record<string, unknown>;
  evidenceNote: string | null;
  reviewNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityReviewQueueItem extends CommunityRouteLearningProposal {
  routeLabel: string | null;
  routeVariantLabel: string | null;
  sourceSubmissionTitle: string | null;
  sourceQuestionTitle: string | null;
  sourceAnswerPreview: string | null;
  aiConfidence: ProposalAiSuggestionRow["confidence"] | null;
  relatedProposalCount: number;
}

export interface CommunityReviewAiSuggestion {
  id: string;
  modelName: string;
  confidence: ProposalAiSuggestionRow["confidence"];
  duplicateKey: string | null;
  suggestedProposalType: ProposalRow["proposal_type"];
  reason: string;
  title: string;
  summary: string | null;
  changeSummary: string;
  reviewNotes: string;
  note: string | null;
  routeCode: string | null;
  routeVariantCode: string | null;
  proposedLifecycleStatus: ProposalRow["proposed_lifecycle_status"];
  reviewedChangeSet: Record<string, unknown>;
  createdAt: string;
}

export interface CommunityRouteLearningProposalDetail extends CommunityReviewQueueItem {
  sourceSubmission: {
    id: string;
    submissionType: SubmissionRow["submission_type"];
    title: string;
    payload: Record<string, unknown>;
    sourceContext: Record<string, unknown> | null;
    status: SubmissionRow["status"];
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
    promotionStatus: AnswerRow["promotion_status"];
  } | null;
  aiSuggestion: CommunityReviewAiSuggestion | null;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asNullableRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const truncateText = (value: string | null | undefined, maxLength = 140) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, maxLength - 3))}...`;
};

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const mapAiSuggestion = (row: ProposalAiSuggestionRow): CommunityReviewAiSuggestion => {
  const suggestion = asRecord(row.suggestion);

  return {
    id: row.id,
    modelName: row.model_name,
    confidence: row.confidence,
    duplicateKey: row.duplicate_key,
    suggestedProposalType:
      (asNullableString(suggestion.suggestedProposalType) as ProposalRow["proposal_type"] | null) ??
      "route_note",
    reason:
      asNullableString(suggestion.reason) ??
      "Reviewer confirmation is still required before publishing.",
    title: asNullableString(suggestion.title) ?? "Community review draft",
    summary: asNullableString(suggestion.summary),
    changeSummary: asNullableString(suggestion.changeSummary) ?? "Community review update",
    reviewNotes:
      asNullableString(suggestion.reviewNotes) ?? "Review manually before publishing this draft.",
    note: asNullableString(suggestion.note),
    routeCode: asNullableString(suggestion.routeCode),
    routeVariantCode: asNullableString(suggestion.routeVariantCode),
    proposedLifecycleStatus:
      (asNullableString(suggestion.proposedLifecycleStatus) as ProposalRow["proposed_lifecycle_status"] | null) ??
      null,
    reviewedChangeSet:
      (() => {
        const reviewedChangeSetText = asNullableString(suggestion.reviewedChangeSetText);

        if (!reviewedChangeSetText) {
          return {};
        }

        try {
          const parsed = JSON.parse(reviewedChangeSetText) as unknown;
          return asRecord(parsed);
        } catch {
          return {};
        }
      })(),
    createdAt: row.created_at
  };
};

const mapProposal = (row: ProposalRow): CommunityRouteLearningProposal => ({
  id: row.id,
  sourceKind: row.source_kind,
  sourceSubmissionId: row.source_submission_id,
  sourceQuestionId: row.source_question_id,
  sourceAnswerId: row.source_answer_id,
  createdByUserId: row.created_by_user_id,
  proposalType: row.proposal_type,
  reviewStatus: row.review_status,
  title: row.title,
  summary: row.summary,
  routeId: row.route_id,
  routeVariantId: row.route_variant_id,
  targetStopIds: [...row.target_stop_ids],
  targetTransferPointIds: [...row.target_transfer_point_ids],
  proposedLifecycleStatus: row.proposed_lifecycle_status,
  payload: asRecord(row.payload),
  reviewedChangeSet: asRecord(row.reviewed_change_set),
  evidenceNote: row.evidence_note,
  reviewNotes: row.review_notes,
  reviewedByUserId: row.reviewed_by_user_id,
  reviewedAt: row.reviewed_at,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const getProposalNotFoundError = () => new HttpError(404, "Community review proposal not found");

const getInvalidProposalStatusError = (proposalId: string, status: string) =>
  new HttpError(409, `Proposal ${proposalId} cannot be reviewed from status ${status}`);

const getAdminClient = () => getSupabaseAdminClient();
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string) => UUID_PATTERN.test(value);

const validateReviewedChangeSet = (
  proposalType: ProposalRow["proposal_type"],
  reviewedChangeSet: unknown,
  proposal?: ProposalRow
) => {
  try {
    const parsed = parseReviewedChangeSetForProposalType(proposalType, reviewedChangeSet);

    if (proposalType === "stop_correction") {
      const stopChangeSet = parsed as {
        stopId?: string;
      };

      if (!stopChangeSet.stopId && (!proposal || proposal.target_stop_ids.length === 0)) {
        throw new HttpError(
          400,
          "Stop correction needs a target stop in the reviewed change set or proposal targets."
        );
      }
    }

    if (proposalType === "transfer_correction") {
      const transferChangeSet = parsed as {
        transferPointId?: string;
        fromStopId?: string;
        toStopId?: string;
      };

      if (
        !transferChangeSet.transferPointId &&
        !(transferChangeSet.fromStopId && transferChangeSet.toStopId) &&
        (!proposal || proposal.target_transfer_point_ids.length === 0)
      ) {
        throw new HttpError(
          400,
          "Transfer correction needs a target transfer point or both stop IDs."
        );
      }
    }

    return parsed;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      const message = error.issues[0]?.message ?? "Invalid reviewed change set.";
      throw new HttpError(400, message);
    }

    throw error;
  }
};

const listRoutesByIds = async (routeIds: string[]): Promise<RouteRow[]> => {
  if (routeIds.length === 0) {
    return [];
  }

  const { data, error } = await getAdminClient()
    .from("routes")
    .select("*")
    .in("id", [...new Set(routeIds)]);

  if (error) {
    throw new HttpError(500, `Failed to fetch routes for community review: ${error.message}`);
  }

  return (data ?? []) as RouteRow[];
};

const listRoutesByCodes = async (routeCodes: string[]): Promise<RouteRow[]> => {
  if (routeCodes.length === 0) {
    return [];
  }

  const { data, error } = await getAdminClient()
    .from("routes")
    .select("*")
    .in("code", [...new Set(routeCodes)]);

  if (error) {
    throw new HttpError(500, `Failed to fetch routes by code for community metadata: ${error.message}`);
  }

  return (data ?? []) as RouteRow[];
};

const listRouteVariantsByIds = async (variantIds: string[]): Promise<RouteVariantRow[]> => {
  if (variantIds.length === 0) {
    return [];
  }

  const { data, error } = await getAdminClient()
    .from("route_variants")
    .select("*")
    .in("id", [...new Set(variantIds)]);

  if (error) {
    throw new HttpError(500, `Failed to fetch route variants for community review: ${error.message}`);
  }

  return (data ?? []) as RouteVariantRow[];
};

const listRouteVariantsByCodes = async (variantCodes: string[]): Promise<RouteVariantRow[]> => {
  if (variantCodes.length === 0) {
    return [];
  }

  const { data, error } = await getAdminClient()
    .from("route_variants")
    .select("*")
    .in("code", [...new Set(variantCodes)]);

  if (error) {
    throw new HttpError(500, `Failed to fetch route variants by code for community metadata: ${error.message}`);
  }

  return (data ?? []) as RouteVariantRow[];
};

const listQuestionsByIds = async (questionIds: string[]): Promise<QuestionRow[]> => {
  if (questionIds.length === 0) {
    return [];
  }

  const { data, error } = await getAdminClient()
    .from("community_questions")
    .select("*")
    .in("id", [...new Set(questionIds)]);

  if (error) {
    throw new HttpError(500, `Failed to fetch proposal questions: ${error.message}`);
  }

  return (data ?? []) as QuestionRow[];
};

const listAnswersByIds = async (answerIds: string[]): Promise<AnswerRow[]> => {
  if (answerIds.length === 0) {
    return [];
  }

  const { data, error } = await getAdminClient()
    .from("community_question_answers")
    .select("*")
    .in("id", [...new Set(answerIds)]);

  if (error) {
    throw new HttpError(500, `Failed to fetch proposal answers: ${error.message}`);
  }

  return (data ?? []) as AnswerRow[];
};

const listSubmissionsByIds = async (submissionIds: string[]): Promise<SubmissionRow[]> => {
  if (submissionIds.length === 0) {
    return [];
  }

  const { data, error } = await getAdminClient()
    .from("community_submissions")
    .select("*")
    .in("id", [...new Set(submissionIds)]);

  if (error) {
    throw new HttpError(500, `Failed to fetch proposal submissions: ${error.message}`);
  }

  return (data ?? []) as SubmissionRow[];
};

const listLatestAiSuggestionsByProposalIds = async (
  proposalIds: string[]
): Promise<Map<string, CommunityReviewAiSuggestion>> => {
  if (proposalIds.length === 0) {
    return new Map();
  }

  const { data, error } = await getAdminClient()
    .from("community_route_ai_suggestions")
    .select("*")
    .in("proposal_id", [...new Set(proposalIds)])
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, `Failed to fetch AI suggestions for proposals: ${error.message}`);
  }

  const rows = (data ?? []) as ProposalAiSuggestionRow[];
  const latestByProposalId = new Map<string, CommunityReviewAiSuggestion>();

  for (const row of rows) {
    if (!row.proposal_id || latestByProposalId.has(row.proposal_id)) {
      continue;
    }

    latestByProposalId.set(row.proposal_id, mapAiSuggestion(row));
  }

  return latestByProposalId;
};

const getDuplicateProposalCounts = (
  aiSuggestions: Iterable<CommunityReviewAiSuggestion>
): Map<string, number> => {
  const countsByDuplicateKey = new Map<string, number>();

  for (const suggestion of aiSuggestions) {
    if (!suggestion.duplicateKey) {
      continue;
    }

    countsByDuplicateKey.set(
      suggestion.duplicateKey,
      (countsByDuplicateKey.get(suggestion.duplicateKey) ?? 0) + 1
    );
  }

  return countsByDuplicateKey;
};

const storeAiSuggestion = async (input: {
  proposalId?: string;
  sourceSubmissionId?: string;
  sourceQuestionId?: string;
  sourceAnswerId?: string;
  modelName: string;
  confidence: ProposalAiSuggestionRow["confidence"];
  duplicateKey: string | null;
  suggestion: Record<string, unknown>;
}): Promise<CommunityReviewAiSuggestion> => {
  const { data, error } = await getAdminClient()
    .from("community_route_ai_suggestions")
    .insert({
      proposal_id: input.proposalId ?? null,
      source_submission_id: input.sourceSubmissionId ?? null,
      source_question_id: input.sourceQuestionId ?? null,
      source_answer_id: input.sourceAnswerId ?? null,
      model_name: input.modelName,
      confidence: input.confidence,
      duplicate_key: input.duplicateKey,
      suggestion: input.suggestion
    })
    .select("*")
    .single();

  if (error) {
    throw new HttpError(500, `Failed to store AI review suggestion: ${error.message}`);
  }

  return mapAiSuggestion(data as ProposalAiSuggestionRow);
};

const getProposalSourceSummaryByProposalId = async (
  proposal: ProposalRow
): Promise<ProposalSourceSummary> => {
  const [submissions, questions, answers] = await Promise.all([
    listSubmissionsByIds(proposal.source_submission_id ? [proposal.source_submission_id] : []),
    listQuestionsByIds(proposal.source_question_id ? [proposal.source_question_id] : []),
    listAnswersByIds(proposal.source_answer_id ? [proposal.source_answer_id] : [])
  ]);

  return {
    submission: submissions[0] ?? null,
    question: questions[0] ?? null,
    answer: answers[0] ?? null
  };
};

const mapProposalQueueItem = (input: {
  proposal: ProposalRow;
  routeMap: Map<string, RouteRow>;
  routeVariantMap: Map<string, RouteVariantRow>;
  sourceSummary: ProposalSourceSummary;
  aiSuggestion: CommunityReviewAiSuggestion | null;
  duplicateCountsByKey: Map<string, number>;
}): CommunityReviewQueueItem => {
  const mapped = mapProposal(input.proposal);
  const route = mapped.routeId ? input.routeMap.get(mapped.routeId) ?? null : null;
  const routeVariant = mapped.routeVariantId
    ? input.routeVariantMap.get(mapped.routeVariantId) ?? null
    : null;

  return {
    ...mapped,
    routeLabel: route ? `${route.code} - ${route.display_name}` : null,
    routeVariantLabel: routeVariant ? routeVariant.display_name : null,
    sourceSubmissionTitle: input.sourceSummary.submission?.title ?? null,
    sourceQuestionTitle: input.sourceSummary.question?.title ?? null,
    sourceAnswerPreview: truncateText(input.sourceSummary.answer?.body ?? null),
    aiConfidence: input.aiSuggestion?.confidence ?? null,
    relatedProposalCount:
      input.aiSuggestion?.duplicateKey
        ? input.duplicateCountsByKey.get(input.aiSuggestion.duplicateKey) ?? 1
        : 1
  };
};

const mapProposalDetail = (input: {
  queueItem: CommunityReviewQueueItem;
  sourceSummary: ProposalSourceSummary;
  aiSuggestion: CommunityReviewAiSuggestion | null;
}): CommunityRouteLearningProposalDetail => ({
  ...input.queueItem,
  sourceSubmission: input.sourceSummary.submission
    ? {
        id: input.sourceSummary.submission.id,
        submissionType: input.sourceSummary.submission.submission_type,
        title: input.sourceSummary.submission.title,
        payload: asRecord(input.sourceSummary.submission.payload),
        sourceContext: asNullableRecord(input.sourceSummary.submission.source_context),
        status: input.sourceSummary.submission.status
      }
    : null,
  sourceQuestion: input.sourceSummary.question
    ? {
        id: input.sourceSummary.question.id,
        title: input.sourceSummary.question.title,
        body: input.sourceSummary.question.body,
        originLabel: input.sourceSummary.question.origin_label,
        destinationLabel: input.sourceSummary.question.destination_label
      }
    : null,
  sourceAnswer: input.sourceSummary.answer
    ? {
        id: input.sourceSummary.answer.id,
        body: input.sourceSummary.answer.body,
        helpfulCount: input.sourceSummary.answer.helpful_count,
        promotionStatus: input.sourceSummary.answer.promotion_status
      }
    : null,
  aiSuggestion: input.aiSuggestion
});

const getProposalById = async (proposalId: string): Promise<ProposalRow> => {
  const { data, error } = await getAdminClient()
    .from("community_route_learning_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `Failed to fetch community proposal: ${error.message}`);
  }

  if (!data) {
    throw getProposalNotFoundError();
  }

  return data as ProposalRow;
};

const createRouteLearningProposal = async (
  record: ProposalInsert
): Promise<CommunityRouteLearningProposal> => {
  const { data, error } = await getAdminClient()
    .from("community_route_learning_proposals")
    .insert(record)
    .select("*")
    .single();

  if (error) {
    throw new HttpError(500, `Failed to create community proposal: ${error.message}`);
  }

  return mapProposal(data as ProposalRow);
};

export const createProposalFromSubmission = async (input: {
  submissionId: string;
  userId: string;
  title: string;
  submissionType: SubmissionRow["submission_type"];
  routeId: string | null;
  routeVariantId: string | null;
  payload: Record<string, unknown>;
  sourceContext: Record<string, unknown> | null;
}): Promise<CommunityRouteLearningProposal> =>
  createRouteLearningProposal({
    source_kind: "direct_submission",
    source_submission_id: input.submissionId,
    created_by_user_id: input.userId,
    proposal_type: mapSubmissionTypeToProposalType(input.submissionType),
    title: input.title,
    summary:
      typeof input.payload.note === "string"
        ? input.payload.note
        : input.sourceContext && typeof input.sourceContext.routeQueryText === "string"
          ? input.sourceContext.routeQueryText
          : null,
    route_id: input.routeId,
    route_variant_id: input.routeVariantId,
    proposed_lifecycle_status:
      input.submissionType === "route_deprecate"
        ? "deprecated"
        : input.submissionType === "route_reactivate"
          ? "active"
          : null,
    payload: input.payload,
    reviewed_change_set: {}
  });

export const promoteAnswerToProposal = async (input: {
  questionId: string;
  answerId: string;
  reviewerUserId: string;
  body: PromoteCommunityAnswerInput;
}): Promise<CommunityRouteLearningProposalDetail> => {
  const [question, answer] = await Promise.all([
    getAdminClient()
      .from("community_questions")
      .select("*")
      .eq("id", input.questionId)
      .maybeSingle(),
    getAdminClient()
      .from("community_question_answers")
      .select("*")
      .eq("id", input.answerId)
      .eq("question_id", input.questionId)
      .maybeSingle()
  ]);

  if (question.error) {
    throw new HttpError(500, `Failed to fetch question for promotion: ${question.error.message}`);
  }

  if (answer.error) {
    throw new HttpError(500, `Failed to fetch answer for promotion: ${answer.error.message}`);
  }

  if (!question.data) {
    throw new HttpError(404, "Community question not found");
  }

  if (!answer.data) {
    throw new HttpError(404, "Community answer not found");
  }

  const resolvedTargets = await resolveRouteTargets({
    routeId: input.body.routeId ?? answer.data.linked_route_id,
    routeVariantId: input.body.routeVariantId ?? answer.data.linked_route_variant_id,
    routeCode: input.body.routeCode ?? null,
    routeVariantCode: input.body.routeVariantCode ?? null
  });
  const reviewedChangeSet = validateReviewedChangeSet(
    input.body.proposalType,
    input.body.reviewedChangeSet ?? {}
  );

  const { data, error } = await getAdminClient().rpc("promote_community_answer_to_proposal", {
    p_question_id: input.questionId,
    p_answer_id: input.answerId,
    p_reviewer_user_id: input.reviewerUserId,
    p_proposal_type: input.body.proposalType,
    p_title: input.body.title,
    p_summary: input.body.summary ?? truncateText(answer.data.body, 280),
    p_route_id: resolvedTargets.routeId,
    p_route_variant_id: resolvedTargets.routeVariantId,
    p_target_stop_ids: input.body.targetStopIds ?? [],
    p_target_transfer_point_ids: input.body.targetTransferPointIds ?? [],
    p_proposed_lifecycle_status: input.body.proposedLifecycleStatus ?? null,
    p_evidence_note: input.body.evidenceNote ?? answer.data.body,
    p_payload: input.body.payload ?? {},
    p_reviewed_change_set: reviewedChangeSet
  });

  if (error) {
    throw new HttpError(500, `Failed to promote answer into proposal: ${error.message}`);
  }

  return getProposalDetail((data as ProposalRow).id);
};

export const listReviewQueue = async (
  filters: ReviewQueueFilter = {}
): Promise<CommunityReviewQueueItem[]> => {
  let query = getAdminClient()
    .from("community_route_learning_proposals")
    .select("*");

  if (filters.status) {
    query = query.eq("review_status", filters.status);
  }

  if (filters.proposalType) {
    query = query.eq("proposal_type", filters.proposalType);
  }

  if (filters.routeId) {
    query = query.eq("route_id", filters.routeId);
  }

  if (filters.routeVariantId) {
    query = query.eq("route_variant_id", filters.routeVariantId);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(50);

  if (error) {
    throw new HttpError(500, `Failed to fetch review queue: ${error.message}`);
  }

  const proposals = (data ?? []) as ProposalRow[];
  const [routes, routeVariants, sourceSummaries, latestAiSuggestions] = await Promise.all([
    listRoutesByIds(proposals.flatMap((proposal) => (proposal.route_id ? [proposal.route_id] : []))),
    listRouteVariantsByIds(
      proposals.flatMap((proposal) => (proposal.route_variant_id ? [proposal.route_variant_id] : []))
    ),
    Promise.all(proposals.map((proposal) => getProposalSourceSummaryByProposalId(proposal))),
    listLatestAiSuggestionsByProposalIds(proposals.map((proposal) => proposal.id))
  ]);
  const routeMap = new Map(routes.map((route) => [route.id, route]));
  const routeVariantMap = new Map(routeVariants.map((routeVariant) => [routeVariant.id, routeVariant]));
  const duplicateCountsByKey = getDuplicateProposalCounts(latestAiSuggestions.values());

  return proposals.map((proposal, index) =>
    mapProposalQueueItem({
      proposal,
      routeMap,
      routeVariantMap,
      aiSuggestion: latestAiSuggestions.get(proposal.id) ?? null,
      duplicateCountsByKey,
      sourceSummary: sourceSummaries[index] ?? {
        submission: null,
        question: null,
        answer: null
      }
    })
  );
};

export const getProposalDetail = async (
  proposalId: string
): Promise<CommunityRouteLearningProposalDetail> => {
  const proposal = await getProposalById(proposalId);
  const [routes, routeVariants, sourceSummary, latestAiSuggestions] = await Promise.all([
    listRoutesByIds(proposal.route_id ? [proposal.route_id] : []),
    listRouteVariantsByIds(proposal.route_variant_id ? [proposal.route_variant_id] : []),
    getProposalSourceSummaryByProposalId(proposal),
    listLatestAiSuggestionsByProposalIds([proposal.id])
  ]);
  const aiSuggestion = latestAiSuggestions.get(proposal.id) ?? null;
  const queueItem = mapProposalQueueItem({
    proposal,
    routeMap: new Map(routes.map((route) => [route.id, route])),
    routeVariantMap: new Map(routeVariants.map((routeVariant) => [routeVariant.id, routeVariant])),
    sourceSummary,
    aiSuggestion,
    duplicateCountsByKey: getDuplicateProposalCounts(latestAiSuggestions.values())
  });

  return mapProposalDetail({
    queueItem,
    sourceSummary,
    aiSuggestion
  });
};

const resolveRouteTargets = async (input: {
  routeId?: string | null;
  routeVariantId?: string | null;
  routeCode?: string | null;
  routeVariantCode?: string | null;
}): Promise<{
  routeId: string | null;
  routeVariantId: string | null;
}> => {
  const [routesByCode, variantsByCode] = await Promise.all([
    input.routeCode ? listRoutesByCodes([input.routeCode]) : Promise.resolve([]),
    input.routeVariantCode ? listRouteVariantsByCodes([input.routeVariantCode]) : Promise.resolve([])
  ]);

  return {
    routeId: input.routeId ?? routesByCode[0]?.id ?? null,
    routeVariantId: input.routeVariantId ?? variantsByCode[0]?.id ?? null
  };
};

export const generateProposalAiDraft = async (proposalId: string): Promise<CommunityReviewAiSuggestion> => {
  const proposal = await getProposalById(proposalId);
  const sourceSummary = await getProposalSourceSummaryByProposalId(proposal);
  const [routes, routeVariants] = await Promise.all([
    listRoutesByIds(proposal.route_id ? [proposal.route_id] : []),
    listRouteVariantsByIds(proposal.route_variant_id ? [proposal.route_variant_id] : [])
  ]);
  const route = routes[0] ?? null;
  const routeVariant = routeVariants[0] ?? null;
  const { draft, modelName } = await generateCommunityReviewAiDraft({
    sourceType: "proposal",
    proposalTypeHint: proposal.proposal_type,
    title: proposal.title,
    summary: proposal.summary,
    questionTitle: sourceSummary.question?.title ?? null,
    questionBody: sourceSummary.question?.body ?? null,
    answerBody: sourceSummary.answer?.body ?? null,
    submissionTitle: sourceSummary.submission?.title ?? null,
    submissionPayload: asNullableRecord(sourceSummary.submission?.payload ?? null),
    sourceContext: asNullableRecord(sourceSummary.submission?.source_context ?? null),
    payload: asRecord(proposal.payload),
    routeId: proposal.route_id,
    routeVariantId: proposal.route_variant_id,
    routeLabel: route ? `${route.code} - ${route.display_name}` : null,
    routeVariantLabel: routeVariant?.display_name ?? null
  });

  return storeAiSuggestion({
    proposalId,
    sourceSubmissionId: proposal.source_submission_id ?? undefined,
    sourceQuestionId: proposal.source_question_id ?? undefined,
    sourceAnswerId: proposal.source_answer_id ?? undefined,
    modelName,
    confidence: draft.confidence,
    duplicateKey: draft.duplicateKey,
    suggestion: draft as unknown as Record<string, unknown>
  });
};

export const generateAnswerAiDraft = async (input: {
  questionId: string;
  answerId: string;
  proposalTypeHint?: ProposalRow["proposal_type"];
  title?: string;
  summary?: string;
}): Promise<CommunityReviewAiSuggestion> => {
  const [question, answer] = await Promise.all([
    getAdminClient().from("community_questions").select("*").eq("id", input.questionId).maybeSingle(),
    getAdminClient()
      .from("community_question_answers")
      .select("*")
      .eq("id", input.answerId)
      .eq("question_id", input.questionId)
      .maybeSingle()
  ]);

  if (question.error) {
    throw new HttpError(500, `Failed to fetch question for AI draft: ${question.error.message}`);
  }

  if (answer.error) {
    throw new HttpError(500, `Failed to fetch answer for AI draft: ${answer.error.message}`);
  }

  if (!question.data || !answer.data) {
    throw new HttpError(404, "Community answer not found");
  }

  const { draft, modelName } = await generateCommunityReviewAiDraft({
    sourceType: "answer",
    proposalTypeHint: input.proposalTypeHint ?? null,
    title: input.title ?? `Community answer: ${question.data.title}`,
    summary: input.summary ?? question.data.body,
    questionTitle: question.data.title,
    questionBody: question.data.body,
    answerBody: answer.data.body,
    sourceContext: asNullableRecord(question.data.source_context)
  });

  return storeAiSuggestion({
    sourceQuestionId: question.data.id,
    sourceAnswerId: answer.data.id,
    modelName,
    confidence: draft.confidence,
    duplicateKey: draft.duplicateKey,
    suggestion: draft as unknown as Record<string, unknown>
  });
};

const updateProposal = async (
  proposalId: string,
  patch: ProposalUpdate
): Promise<ProposalRow> => {
  const { data, error } = await getAdminClient()
    .from("community_route_learning_proposals")
    .update(patch)
    .eq("id", proposalId)
    .select("*")
    .single();

  if (error) {
    throw new HttpError(500, `Failed to update proposal ${proposalId}: ${error.message}`);
  }

  return data as ProposalRow;
};

const maybeUpdateLinkedSubmissionStatus = async (
  proposal: ProposalRow,
  status: SubmissionRow["status"],
  reviewNotes: string | null
) => {
  if (!proposal.source_submission_id) {
    return;
  }

  const { error } = await getAdminClient()
    .from("community_submissions")
    .update({
      status,
      review_notes: reviewNotes
    })
    .eq("id", proposal.source_submission_id);

  if (error) {
    throw new HttpError(500, `Failed to update linked submission status: ${error.message}`);
  }
};

const maybeUpdateLinkedAnswerPromotionStatus = async (
  proposal: ProposalRow,
  promotionStatus: AnswerRow["promotion_status"]
) => {
  if (!proposal.source_answer_id) {
    return;
  }

  const { error } = await getAdminClient()
    .from("community_question_answers")
    .update({
      promotion_status: promotionStatus,
      linked_route_id: proposal.route_id,
      linked_route_variant_id: proposal.route_variant_id
    })
    .eq("id", proposal.source_answer_id);

  if (error) {
    throw new HttpError(500, `Failed to update linked answer promotion state: ${error.message}`);
  }
};

const buildPublicationSnapshot = async (proposal: ProposalRow) => {
  const [routes, routeVariants] = await Promise.all([
    listRoutesByIds(proposal.route_id ? [proposal.route_id] : []),
    listRouteVariantsByIds(proposal.route_variant_id ? [proposal.route_variant_id] : [])
  ]);

  return {
    proposal: mapProposal(proposal),
    route: routes[0]
      ? {
          id: routes[0].id,
          code: routes[0].code,
          displayName: routes[0].display_name,
          lifecycleStatus: routes[0].lifecycle_status,
          trustLevel: routes[0].trust_level,
          isActive: routes[0].is_active
        }
      : null,
    routeVariant: routeVariants[0]
      ? {
          id: routeVariants[0].id,
          code: routeVariants[0].code,
          displayName: routeVariants[0].display_name,
          lifecycleStatus: routeVariants[0].lifecycle_status,
          isActive: routeVariants[0].is_active
        }
      : null
  };
};

const publishRouteLifecycleChange = async (
  proposal: ProposalRow,
  nextLifecycleStatus: RouteRow["lifecycle_status"]
) => {
  if (proposal.route_variant_id) {
    const { error } = await getAdminClient()
      .from("route_variants")
      .update({
        lifecycle_status: nextLifecycleStatus,
        is_active: nextLifecycleStatus === "active"
      })
      .eq("id", proposal.route_variant_id);

    if (error) {
      throw new HttpError(500, `Failed to update route variant lifecycle: ${error.message}`);
    }
  }

  if (proposal.route_id) {
    const { error } = await getAdminClient()
      .from("routes")
      .update({
        lifecycle_status: nextLifecycleStatus,
        is_active: nextLifecycleStatus === "active",
        trust_level: "community_reviewed"
      })
      .eq("id", proposal.route_id);

    if (error) {
      throw new HttpError(500, `Failed to update route lifecycle: ${error.message}`);
    }
  }
};

const markCommunityReviewedRoute = async (proposal: ProposalRow) => {
  if (!proposal.route_id) {
    return;
  }

  const { error } = await getAdminClient()
    .from("routes")
    .update({
      trust_level: "community_reviewed"
    })
    .eq("id", proposal.route_id);

  if (error) {
    throw new HttpError(500, `Failed to mark route as community reviewed: ${error.message}`);
  }
};

const createPublication = async (input: {
  proposal: ProposalRow;
  reviewerUserId: string;
  changeSummary: string;
}): Promise<PublicationRow> => {
  const snapshot = await buildPublicationSnapshot(input.proposal);
  const { data, error } = await getAdminClient()
    .from("community_route_publications")
    .insert({
      proposal_id: input.proposal.id,
      reviewer_user_id: input.reviewerUserId,
      route_id: input.proposal.route_id,
      route_variant_id: input.proposal.route_variant_id,
      publication_action: input.proposal.proposal_type,
      change_summary: input.changeSummary,
      published_snapshot: snapshot
    })
    .select("*")
    .single();

  if (error) {
    throw new HttpError(500, `Failed to create route publication: ${error.message}`);
  }

  return data as PublicationRow;
};

const maybeCreateRouteNote = async (input: {
  publicationId: string;
  proposal: ProposalRow;
  note: string | null;
}) => {
  if (!input.note || (!input.proposal.route_id && !input.proposal.route_variant_id)) {
    return;
  }

  const { error } = await getAdminClient()
    .from("community_route_notes")
    .insert({
      publication_id: input.publicationId,
      route_id: input.proposal.route_id,
      route_variant_id: input.proposal.route_variant_id,
      note: input.note,
      is_active: true
    });

  if (error) {
    throw new HttpError(500, `Failed to create route note: ${error.message}`);
  }
};

const publishProposal = async (input: {
  proposal: ProposalRow;
  reviewerUserId: string;
  body: ApproveCommunityProposalInput;
}) => {
  if (
    !COMMUNITY_PROPOSAL_TYPES.includes(input.proposal.proposal_type) ||
    !COMMUNITY_REVIEW_STATUSES.includes(input.proposal.review_status) ||
    (input.proposal.proposed_lifecycle_status !== null &&
      !COMMUNITY_ROUTE_LIFECYCLE_STATUSES.includes(input.proposal.proposed_lifecycle_status))
  ) {
    throw new HttpError(500, "Proposal contains unsupported community workflow values");
  }

  if (input.proposal.review_status === "rejected" || input.proposal.review_status === "published") {
    throw getInvalidProposalStatusError(input.proposal.id, input.proposal.review_status);
  }

  if (input.proposal.proposal_type === "route_deprecate") {
    await publishRouteLifecycleChange(input.proposal, "deprecated");
  } else if (input.proposal.proposal_type === "route_reactivate") {
    await publishRouteLifecycleChange(input.proposal, "active");
  } else {
    await markCommunityReviewedRoute(input.proposal);
  }

  const publication = await createPublication({
    proposal: input.proposal,
    reviewerUserId: input.reviewerUserId,
    changeSummary: input.body.changeSummary
  });

  const note =
    input.body.note ??
    (typeof input.proposal.payload.note === "string" ? input.proposal.payload.note : null) ??
    input.proposal.evidence_note ??
    input.proposal.summary;

  await maybeCreateRouteNote({
    publicationId: publication.id,
    proposal: input.proposal,
    note
  });

  await updateProposal(input.proposal.id, {
    review_status: "published",
    review_notes: input.body.reviewNotes ?? null,
    reviewed_by_user_id: input.reviewerUserId,
    reviewed_at: new Date().toISOString(),
    published_at: new Date().toISOString()
  });
  await maybeUpdateLinkedSubmissionStatus(input.proposal, "published", input.body.reviewNotes ?? null);
  await maybeUpdateLinkedAnswerPromotionStatus(input.proposal, "published");
};

export const approveProposal = async (input: {
  proposalId: string;
  reviewerUserId: string;
  body: ApproveCommunityProposalInput;
}): Promise<CommunityRouteLearningProposalDetail> => {
  const proposal = await getProposalById(input.proposalId);
  if (proposal.review_status === "published") {
    return getProposalDetail(proposal.id);
  }

  if (proposal.review_status === "rejected") {
    throw getInvalidProposalStatusError(proposal.id, proposal.review_status);
  }
  const reviewedChangeSet =
    input.body.reviewedChangeSet === undefined
      ? undefined
      : validateReviewedChangeSet(proposal.proposal_type, input.body.reviewedChangeSet, proposal);

  const { error } = await getAdminClient().rpc("publish_community_route_proposal", {
    p_proposal_id: proposal.id,
    p_reviewer_user_id: input.reviewerUserId,
    p_change_summary: input.body.changeSummary,
    p_review_notes: input.body.reviewNotes ?? null,
    p_note: input.body.note ?? null,
    p_reviewed_change_set: reviewedChangeSet ?? null
  });

  if (error) {
    throw new HttpError(500, `Failed to publish community proposal: ${error.message}`);
  }

  return getProposalDetail(proposal.id);
};

export const rejectProposal = async (input: {
  proposalId: string;
  reviewerUserId: string;
  body: RejectCommunityProposalInput;
}): Promise<CommunityRouteLearningProposalDetail> => {
  const proposal = await getProposalById(input.proposalId);

  if (proposal.review_status === "published" || proposal.review_status === "rejected") {
    throw getInvalidProposalStatusError(proposal.id, proposal.review_status);
  }

  const { error } = await getAdminClient().rpc("reject_community_route_proposal", {
    p_proposal_id: proposal.id,
    p_reviewer_user_id: input.reviewerUserId,
    p_review_notes: input.body.reviewNotes
  });

  if (error) {
    throw new HttpError(500, `Failed to reject community proposal: ${error.message}`);
  }

  return getProposalDetail(proposal.id);
};

const listPublicationRows = async (input: {
  routeIds: string[];
  routeVariantIds: string[];
}): Promise<PublicationRow[]> => {
  const uniqueRouteIds = [...new Set(input.routeIds)];
  const uniqueRouteVariantIds = [...new Set(input.routeVariantIds)];

  if (uniqueRouteIds.length === 0 && uniqueRouteVariantIds.length === 0) {
    return [];
  }

  let query = getAdminClient().from("community_route_publications").select("*");

  if (uniqueRouteIds.length > 0 && uniqueRouteVariantIds.length > 0) {
    query = query.or(
      `route_id.in.(${uniqueRouteIds.join(",")}),route_variant_id.in.(${uniqueRouteVariantIds.join(",")})`
    );
  } else if (uniqueRouteIds.length > 0) {
    query = query.in("route_id", uniqueRouteIds);
  } else {
    query = query.in("route_variant_id", uniqueRouteVariantIds);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);

  if (error) {
    throw new HttpError(500, `Failed to fetch route publications: ${error.message}`);
  }

  return (data ?? []) as PublicationRow[];
};

const listRouteNotes = async (input: {
  routeIds: string[];
  routeVariantIds: string[];
}): Promise<RouteNoteRow[]> => {
  const uniqueRouteIds = [...new Set(input.routeIds)];
  const uniqueRouteVariantIds = [...new Set(input.routeVariantIds)];

  if (uniqueRouteIds.length === 0 && uniqueRouteVariantIds.length === 0) {
    return [];
  }

  let query = getAdminClient()
    .from("community_route_notes")
    .select("*")
    .eq("is_active", true);

  if (uniqueRouteIds.length > 0 && uniqueRouteVariantIds.length > 0) {
    query = query.or(
      `route_id.in.(${uniqueRouteIds.join(",")}),route_variant_id.in.(${uniqueRouteVariantIds.join(",")})`
    );
  } else if (uniqueRouteIds.length > 0) {
    query = query.in("route_id", uniqueRouteIds);
  } else {
    query = query.in("route_variant_id", uniqueRouteVariantIds);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);

  if (error) {
    throw new HttpError(500, `Failed to fetch route notes: ${error.message}`);
  }

  return (data ?? []) as RouteNoteRow[];
};

const mapPublicationToCommunityUpdate = (row: PublicationRow): RouteCommunityUpdate => ({
  id: row.id,
  action: row.publication_action,
  summary: row.change_summary,
  publishedAt: row.created_at
});

const mapRouteNote = (row: RouteNoteRow): RouteCommunityNote => ({
  id: row.id,
  note: row.note,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  createdAt: row.created_at
});

const createRouteCommunityMetadata = (input: {
  route: RouteRow;
  routeVariant: RouteVariantRow | null;
  recentUpdates: RouteCommunityUpdate[];
  activeNotes: RouteCommunityNote[];
}): RouteCommunityMetadata => ({
  routeId: input.route.id,
  routeVariantId: input.routeVariant?.id ?? null,
  routeVariantCode: input.routeVariant?.code ?? null,
  routeCode: input.route.code,
  routeName: input.route.display_name,
  lifecycleStatus: input.routeVariant?.lifecycle_status ?? input.route.lifecycle_status,
  trustLevel: input.route.trust_level,
  recentUpdates: input.recentUpdates,
  activeNotes: input.activeNotes
});

export const buildRouteCommunityMetadataLookup = async (input: {
  routeIds?: string[];
  routeCodes?: string[];
  routeVariantIds?: string[];
  routeVariantCodes?: string[];
}): Promise<Map<string, RouteCommunityMetadata>> => {
  const [routesById, routesByCode, variantsById, variantsByCode] = await Promise.all([
    listRoutesByIds((input.routeIds ?? []).filter(isUuid)),
    listRoutesByCodes(input.routeCodes ?? []),
    listRouteVariantsByIds((input.routeVariantIds ?? []).filter(isUuid)),
    listRouteVariantsByCodes(input.routeVariantCodes ?? [])
  ]);
  const routes = [...routesById, ...routesByCode].filter(
    (route, index, items) => items.findIndex((item) => item.id === route.id) === index
  );
  const variants = [...variantsById, ...variantsByCode].filter(
    (routeVariant, index, items) =>
      items.findIndex((item) => item.id === routeVariant.id) === index
  );
  const [publications, routeNotes] = await Promise.all([
    listPublicationRows({
      routeIds: routes.map((route) => route.id),
      routeVariantIds: variants.map((routeVariant) => routeVariant.id)
    }),
    listRouteNotes({
      routeIds: routes.map((route) => route.id),
      routeVariantIds: variants.map((routeVariant) => routeVariant.id)
    })
  ]);
  const routeMap = new Map(routes.map((route) => [route.id, route]));
  const metadataByKey = new Map<string, RouteCommunityMetadata>();

  for (const route of routes) {
    const routeVariants = variants.filter((routeVariant) => routeVariant.route_id === route.id);
    const preferredVariant = routeVariants[0] ?? null;
    const metadata = createRouteCommunityMetadata({
      route,
      routeVariant: preferredVariant,
      recentUpdates: publications
        .filter(
          (publication) =>
            publication.route_id === route.id ||
            routeVariants.some((routeVariant) => routeVariant.id === publication.route_variant_id)
        )
        .slice(0, 3)
        .map(mapPublicationToCommunityUpdate),
      activeNotes: routeNotes
        .filter(
          (routeNote) =>
            routeNote.route_id === route.id ||
            routeVariants.some((routeVariant) => routeVariant.id === routeNote.route_variant_id)
        )
        .slice(0, 3)
        .map(mapRouteNote)
    });

    metadataByKey.set(`route-id:${route.id}`, metadata);
    metadataByKey.set(`route-code:${route.code}`, metadata);
  }

  for (const routeVariant of variants) {
    const route = routeMap.get(routeVariant.route_id);

    if (!route) {
      continue;
    }

    const metadata = createRouteCommunityMetadata({
      route,
      routeVariant,
      recentUpdates: publications
        .filter(
          (publication) =>
            publication.route_variant_id === routeVariant.id || publication.route_id === route.id
        )
        .slice(0, 3)
        .map(mapPublicationToCommunityUpdate),
      activeNotes: routeNotes
        .filter(
          (routeNote) =>
            routeNote.route_variant_id === routeVariant.id || routeNote.route_id === route.id
        )
        .slice(0, 3)
        .map(mapRouteNote)
    });

    metadataByKey.set(`variant-id:${routeVariant.id}`, metadata);
    metadataByKey.set(`variant-code:${routeVariant.code}`, metadata);
    if (!metadataByKey.has(`route-id:${route.id}`)) {
      metadataByKey.set(`route-id:${route.id}`, metadata);
    }
    if (!metadataByKey.has(`route-code:${route.code}`)) {
      metadataByKey.set(`route-code:${route.code}`, metadata);
    }
  }

  return metadataByKey;
};
