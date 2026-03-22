import { isRecord, requestData } from '../api/base';
import type {
  CommunityReviewAiSuggestion,
  CommunityQuestion,
  CommunityQuestionAnswer,
  CommunityQuestionDetail,
  CommunityReviewProposal,
  CommunityReviewProposalDetail,
  CommunitySubmission,
  CommunityProposalType,
  CommunitySubmissionStatus,
  CommunitySubmissionType,
} from './types';
import type { CommunityReviewedChangeSet } from './review-change-set-types';
import { coerceReviewedChangeSet } from './review-change-set-types';

const parseString = (value: unknown, field: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field} in community response`);
  }

  return value;
};

const parseNullableString = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return parseString(value, field);
};

const parseNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Invalid ${field} in community response`);
  }

  return value;
};

const parseObject = (value: unknown): Record<string, unknown> | null =>
  isRecord(value) ? value : null;

const parseSubmissionType = (value: unknown): CommunitySubmissionType => {
  const submissionType = parseString(value, 'submissionType');

  if (
    submissionType !== 'missing_route' &&
    submissionType !== 'route_correction' &&
    submissionType !== 'fare_update' &&
    submissionType !== 'route_note' &&
    submissionType !== 'route_create' &&
    submissionType !== 'route_update' &&
    submissionType !== 'route_deprecate' &&
    submissionType !== 'route_reactivate' &&
    submissionType !== 'stop_correction' &&
    submissionType !== 'transfer_correction'
  ) {
    throw new Error('Invalid submissionType in community response');
  }

  return submissionType;
};

const parseSubmissionStatus = (value: unknown): CommunitySubmissionStatus => {
  const status = parseString(value, 'status');

  if (
    status !== 'pending' &&
    status !== 'reviewed' &&
    status !== 'under_review' &&
    status !== 'approved' &&
    status !== 'rejected' &&
    status !== 'published'
  ) {
    throw new Error('Invalid submission status in community response');
  }

  if (status === 'reviewed') {
    return 'under_review';
  }

  if (status !== 'under_review' && status !== 'published') {
    return status as CommunitySubmissionStatus;
  }

  return status;
};

const parseProposalType = (value: unknown): CommunityProposalType => {
  const proposalType = parseString(value, 'proposalType');

  if (
    proposalType !== 'route_create' &&
    proposalType !== 'route_update' &&
    proposalType !== 'route_deprecate' &&
    proposalType !== 'route_reactivate' &&
    proposalType !== 'stop_correction' &&
    proposalType !== 'transfer_correction' &&
    proposalType !== 'fare_update' &&
    proposalType !== 'route_note'
  ) {
    throw new Error('Invalid proposalType in community response');
  }

  return proposalType;
};

const parsePromotionStatus = (value: unknown): CommunityQuestionAnswer['promotionStatus'] => {
  const promotionStatus = parseString(value, 'promotionStatus');

  if (
    promotionStatus !== 'not_reviewed' &&
    promotionStatus !== 'promoted' &&
    promotionStatus !== 'published'
  ) {
    throw new Error('Invalid promotion status in community response');
  }

  return promotionStatus;
};

const parseAiConfidence = (value: unknown): CommunityReviewAiSuggestion['confidence'] => {
  const confidence = parseString(value, 'confidence');

  if (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low') {
    throw new Error('Invalid AI confidence in community response');
  }

  return confidence;
};

const parseReviewAiSuggestion = (value: unknown): CommunityReviewAiSuggestion => {
  if (!isRecord(value)) {
    throw new Error('Invalid AI review suggestion');
  }

  const suggestedProposalType = parseProposalType(value.suggestedProposalType);

  return {
    id: parseString(value.id, 'aiSuggestion.id'),
    modelName: parseString(value.modelName, 'aiSuggestion.modelName'),
    confidence: parseAiConfidence(value.confidence),
    duplicateKey: parseNullableString(value.duplicateKey, 'aiSuggestion.duplicateKey'),
    suggestedProposalType,
    reason: parseString(value.reason, 'aiSuggestion.reason'),
    title: parseString(value.title, 'aiSuggestion.title'),
    summary: parseNullableString(value.summary, 'aiSuggestion.summary'),
    changeSummary: parseString(value.changeSummary, 'aiSuggestion.changeSummary'),
    reviewNotes: parseString(value.reviewNotes, 'aiSuggestion.reviewNotes'),
    note: parseNullableString(value.note, 'aiSuggestion.note'),
    routeCode: parseNullableString(value.routeCode, 'aiSuggestion.routeCode'),
    routeVariantCode: parseNullableString(value.routeVariantCode, 'aiSuggestion.routeVariantCode'),
    proposedLifecycleStatus: parseNullableString(
      value.proposedLifecycleStatus,
      'aiSuggestion.proposedLifecycleStatus'
    ) as CommunityReviewAiSuggestion['proposedLifecycleStatus'],
    reviewedChangeSet: coerceReviewedChangeSet(suggestedProposalType, parseObject(value.reviewedChangeSet)),
    createdAt: parseString(value.createdAt, 'aiSuggestion.createdAt'),
  };
};

const parseCommunitySubmission = (value: unknown): CommunitySubmission => {
  if (!isRecord(value)) {
    throw new Error('Invalid community submission');
  }

  const payload = parseObject(value.payload);

  if (!payload) {
    throw new Error('Invalid community submission payload');
  }

  return {
    id: parseString(value.id, 'id'),
    userId: parseString(value.userId, 'userId'),
    submissionType: parseSubmissionType(value.submissionType),
    status: parseSubmissionStatus(value.status),
    title: parseString(value.title, 'title'),
    payload,
    sourceContext: parseObject(value.sourceContext),
    routeId: parseNullableString(value.routeId, 'routeId'),
    routeVariantId: parseNullableString(value.routeVariantId, 'routeVariantId'),
    reviewNotes: parseNullableString(value.reviewNotes, 'reviewNotes'),
    createdAt: parseString(value.createdAt, 'createdAt'),
    updatedAt: parseString(value.updatedAt, 'updatedAt'),
  };
};

const parseQuestionPreference = (value: unknown): CommunityQuestion['preference'] => {
  const preference = parseNullableString(value, 'preference');

  if (preference === null) {
    return null;
  }

  if (preference !== 'fastest' && preference !== 'cheapest' && preference !== 'balanced') {
    throw new Error('Invalid question preference in community response');
  }

  return preference;
};

const parseQuestionPassengerType = (value: unknown): CommunityQuestion['passengerType'] => {
  const passengerType = parseNullableString(value, 'passengerType');

  if (passengerType === null) {
    return null;
  }

  if (
    passengerType !== 'regular' &&
    passengerType !== 'student' &&
    passengerType !== 'senior' &&
    passengerType !== 'pwd'
  ) {
    throw new Error('Invalid question passengerType in community response');
  }

  return passengerType;
};

const parseCommunityQuestion = (value: unknown): CommunityQuestion => {
  if (!isRecord(value)) {
    throw new Error('Invalid community question');
  }

  return {
    id: parseString(value.id, 'id'),
    userId: parseString(value.userId, 'userId'),
    title: parseString(value.title, 'title'),
    body: parseString(value.body, 'body'),
    originLabel: parseString(value.originLabel, 'originLabel'),
    destinationLabel: parseString(value.destinationLabel, 'destinationLabel'),
    originPlaceId: parseNullableString(value.originPlaceId, 'originPlaceId'),
    destinationPlaceId: parseNullableString(value.destinationPlaceId, 'destinationPlaceId'),
    routeQueryText: parseNullableString(value.routeQueryText, 'routeQueryText'),
    preference: parseQuestionPreference(value.preference),
    passengerType: parseQuestionPassengerType(value.passengerType),
    sourceContext: parseObject(value.sourceContext),
    replyCount: parseNumber(value.replyCount, 'replyCount'),
    lastAnsweredAt: parseNullableString(value.lastAnsweredAt, 'lastAnsweredAt'),
    createdAt: parseString(value.createdAt, 'createdAt'),
    updatedAt: parseString(value.updatedAt, 'updatedAt'),
  };
};

const parseCommunityQuestionAnswer = (value: unknown): CommunityQuestionAnswer => {
  if (!isRecord(value)) {
    throw new Error('Invalid community answer');
  }

  return {
    id: parseString(value.id, 'id'),
    questionId: parseString(value.questionId, 'questionId'),
    userId: parseString(value.userId, 'userId'),
    body: parseString(value.body, 'body'),
    helpfulCount: parseNumber(value.helpfulCount, 'helpfulCount'),
    promotionStatus: parsePromotionStatus(value.promotionStatus),
    linkedRouteId: parseNullableString(value.linkedRouteId, 'linkedRouteId'),
    linkedRouteVariantId: parseNullableString(value.linkedRouteVariantId, 'linkedRouteVariantId'),
    createdAt: parseString(value.createdAt, 'createdAt'),
    updatedAt: parseString(value.updatedAt, 'updatedAt'),
  };
};

const parseReviewProposal = (value: unknown): CommunityReviewProposal => {
  if (!isRecord(value)) {
    throw new Error('Invalid review proposal');
  }

  const proposalType = parseProposalType(value.proposalType);

  return {
    id: parseString(value.id, 'id'),
    sourceKind: parseString(value.sourceKind, 'sourceKind') as CommunityReviewProposal['sourceKind'],
    sourceSubmissionId: parseNullableString(value.sourceSubmissionId, 'sourceSubmissionId'),
    sourceQuestionId: parseNullableString(value.sourceQuestionId, 'sourceQuestionId'),
    sourceAnswerId: parseNullableString(value.sourceAnswerId, 'sourceAnswerId'),
    createdByUserId: parseString(value.createdByUserId, 'createdByUserId'),
    proposalType,
    reviewStatus: parseSubmissionStatus(value.reviewStatus),
    title: parseString(value.title, 'title'),
    summary: parseNullableString(value.summary, 'summary'),
    routeId: parseNullableString(value.routeId, 'routeId'),
    routeVariantId: parseNullableString(value.routeVariantId, 'routeVariantId'),
    targetStopIds: Array.isArray(value.targetStopIds)
      ? value.targetStopIds.map((item) => parseString(item, 'targetStopIds'))
      : [],
    targetTransferPointIds: Array.isArray(value.targetTransferPointIds)
      ? value.targetTransferPointIds.map((item) => parseString(item, 'targetTransferPointIds'))
      : [],
    proposedLifecycleStatus: parseNullableString(
      value.proposedLifecycleStatus,
      'proposedLifecycleStatus'
    ) as CommunityReviewProposal['proposedLifecycleStatus'],
    payload: parseObject(value.payload) ?? {},
    reviewedChangeSet: coerceReviewedChangeSet(proposalType, parseObject(value.reviewedChangeSet)),
    evidenceNote: parseNullableString(value.evidenceNote, 'evidenceNote'),
    reviewNotes: parseNullableString(value.reviewNotes, 'reviewNotes'),
    reviewedByUserId: parseNullableString(value.reviewedByUserId, 'reviewedByUserId'),
    reviewedAt: parseNullableString(value.reviewedAt, 'reviewedAt'),
    publishedAt: parseNullableString(value.publishedAt, 'publishedAt'),
    createdAt: parseString(value.createdAt, 'createdAt'),
    updatedAt: parseString(value.updatedAt, 'updatedAt'),
    routeLabel: parseNullableString(value.routeLabel, 'routeLabel'),
    routeVariantLabel: parseNullableString(value.routeVariantLabel, 'routeVariantLabel'),
    sourceSubmissionTitle: parseNullableString(value.sourceSubmissionTitle, 'sourceSubmissionTitle'),
    sourceQuestionTitle: parseNullableString(value.sourceQuestionTitle, 'sourceQuestionTitle'),
    sourceAnswerPreview: parseNullableString(value.sourceAnswerPreview, 'sourceAnswerPreview'),
    aiConfidence:
      value.aiConfidence === null || value.aiConfidence === undefined
        ? null
        : parseAiConfidence(value.aiConfidence),
    relatedProposalCount: parseNumber(value.relatedProposalCount, 'relatedProposalCount'),
  };
};

const parseReviewProposalDetail = (value: unknown): CommunityReviewProposalDetail => {
  if (!isRecord(value)) {
    throw new Error('Invalid review proposal detail');
  }

  return {
    ...parseReviewProposal(value),
    sourceSubmission:
      isRecord(value.sourceSubmission) && value.sourceSubmission !== null
        ? {
            id: parseString(value.sourceSubmission.id, 'sourceSubmission.id'),
            submissionType: parseSubmissionType(value.sourceSubmission.submissionType),
            title: parseString(value.sourceSubmission.title, 'sourceSubmission.title'),
            payload: parseObject(value.sourceSubmission.payload) ?? {},
            sourceContext: parseObject(value.sourceSubmission.sourceContext),
            status: parseSubmissionStatus(value.sourceSubmission.status),
          }
        : null,
    sourceQuestion:
      isRecord(value.sourceQuestion) && value.sourceQuestion !== null
        ? {
            id: parseString(value.sourceQuestion.id, 'sourceQuestion.id'),
            title: parseString(value.sourceQuestion.title, 'sourceQuestion.title'),
            body: parseString(value.sourceQuestion.body, 'sourceQuestion.body'),
            originLabel: parseString(value.sourceQuestion.originLabel, 'sourceQuestion.originLabel'),
            destinationLabel: parseString(
              value.sourceQuestion.destinationLabel,
              'sourceQuestion.destinationLabel'
            ),
          }
        : null,
    sourceAnswer:
      isRecord(value.sourceAnswer) && value.sourceAnswer !== null
        ? {
            id: parseString(value.sourceAnswer.id, 'sourceAnswer.id'),
            body: parseString(value.sourceAnswer.body, 'sourceAnswer.body'),
            helpfulCount: parseNumber(value.sourceAnswer.helpfulCount, 'sourceAnswer.helpfulCount'),
            promotionStatus: parsePromotionStatus(value.sourceAnswer.promotionStatus),
          }
        : null,
    aiSuggestion:
      isRecord(value.aiSuggestion) && value.aiSuggestion !== null
        ? parseReviewAiSuggestion(value.aiSuggestion)
        : null,
  };
};

const parseSubmissionList = (value: unknown): CommunitySubmission[] => {
  if (!Array.isArray(value)) {
    throw new Error('Invalid submission list');
  }

  return value.map(parseCommunitySubmission);
};

const parseQuestionList = (value: unknown): CommunityQuestion[] => {
  if (!Array.isArray(value)) {
    throw new Error('Invalid question list');
  }

  return value.map(parseCommunityQuestion);
};

const parseQuestionDetail = (value: unknown): CommunityQuestionDetail => {
  if (!isRecord(value) || !Array.isArray(value.answers)) {
    throw new Error('Invalid question detail');
  }

  return {
    question: parseCommunityQuestion(value.question),
    answers: value.answers.map(parseCommunityQuestionAnswer),
  };
};

const parseReviewProposalList = (value: unknown): CommunityReviewProposal[] => {
  if (!Array.isArray(value)) {
    throw new Error('Invalid review proposal list');
  }

  return value.map(parseReviewProposal);
};

export const getMyCommunitySubmissions = async (accessToken: string): Promise<CommunitySubmission[]> =>
  requestData(
    {
      method: 'GET',
      path: '/api/community/submissions/mine',
      accessToken,
    },
    parseSubmissionList
  );

export const createCommunitySubmission = async (
  accessToken: string,
  body: {
    submissionType: CommunitySubmissionType;
    title: string;
    payload: Record<string, unknown>;
    sourceContext?: Record<string, unknown>;
    routeId?: string;
    routeVariantId?: string;
  }
): Promise<CommunitySubmission> =>
  requestData(
    {
      method: 'POST',
      path: '/api/community/submissions',
      accessToken,
      body,
    },
    parseCommunitySubmission
  );

export const getMyCommunityQuestions = async (accessToken: string): Promise<CommunityQuestion[]> =>
  requestData(
    {
      method: 'GET',
      path: '/api/community/questions/mine',
      accessToken,
    },
    parseQuestionList
  );

export const getRecentCommunityQuestions = async (accessToken: string): Promise<CommunityQuestion[]> =>
  requestData(
    {
      method: 'GET',
      path: '/api/community/questions/recent',
      accessToken,
    },
    parseQuestionList
  );

export const createCommunityQuestion = async (
  accessToken: string,
  body: {
    title: string;
    body: string;
    originLabel: string;
    destinationLabel: string;
    originPlaceId?: string;
    destinationPlaceId?: string;
    routeQueryText?: string;
    preference?: CommunityQuestion['preference'];
    passengerType?: CommunityQuestion['passengerType'];
    sourceContext?: Record<string, unknown>;
  }
): Promise<CommunityQuestion> =>
  requestData(
    {
      method: 'POST',
      path: '/api/community/questions',
      accessToken,
      body,
    },
    parseCommunityQuestion
  );

export const getCommunityQuestionDetail = async (
  accessToken: string,
  questionId: string
): Promise<CommunityQuestionDetail> =>
  requestData(
    {
      method: 'GET',
      path: `/api/community/questions/${encodeURIComponent(questionId)}`,
      accessToken,
    },
    parseQuestionDetail
  );

export const createCommunityAnswer = async (
  accessToken: string,
  questionId: string,
  body: {
    body: string;
  }
): Promise<CommunityQuestionAnswer> =>
  requestData(
    {
      method: 'POST',
      path: `/api/community/questions/${encodeURIComponent(questionId)}/answers`,
      accessToken,
      body,
    },
    parseCommunityQuestionAnswer
  );

export const getCommunityReviewQueue = async (
  accessToken: string,
  filters?: {
    status?: CommunitySubmissionStatus;
    proposalType?: CommunityProposalType;
    routeId?: string;
    routeVariantId?: string;
  }
): Promise<CommunityReviewProposal[]> => {
  const searchParams = new URLSearchParams();

  if (filters?.status) {
    searchParams.set('status', filters.status);
  }

  if (filters?.proposalType) {
    searchParams.set('proposalType', filters.proposalType);
  }

  if (filters?.routeId) {
    searchParams.set('routeId', filters.routeId);
  }

  if (filters?.routeVariantId) {
    searchParams.set('routeVariantId', filters.routeVariantId);
  }

  const suffix = searchParams.toString();

  return requestData(
    {
      method: 'GET',
      path: `/api/community/review/queue${suffix.length > 0 ? `?${suffix}` : ''}`,
      accessToken,
    },
    parseReviewProposalList
  );
};

export const getCommunityReviewProposalDetail = async (
  accessToken: string,
  proposalId: string
): Promise<CommunityReviewProposalDetail> =>
  requestData(
    {
      method: 'GET',
      path: `/api/community/review/proposals/${encodeURIComponent(proposalId)}`,
      accessToken,
    },
    parseReviewProposalDetail
  );

export const promoteCommunityAnswer = async (
  accessToken: string,
  questionId: string,
  answerId: string,
  body: {
    proposalType: CommunityProposalType;
    title: string;
    summary?: string;
    routeId?: string;
    routeVariantId?: string;
    routeCode?: string;
    routeVariantCode?: string;
    targetStopIds?: string[];
    targetTransferPointIds?: string[];
    proposedLifecycleStatus?: 'active' | 'deprecated' | 'superseded';
    evidenceNote?: string;
    payload?: Record<string, unknown>;
    reviewedChangeSet?: CommunityReviewedChangeSet;
  }
): Promise<CommunityReviewProposalDetail> =>
  requestData(
    {
      method: 'POST',
      path: `/api/community/questions/${encodeURIComponent(questionId)}/answers/${encodeURIComponent(answerId)}/promote`,
      accessToken,
      body,
    },
    parseReviewProposalDetail
  );

export const approveCommunityProposal = async (
  accessToken: string,
  proposalId: string,
  body: {
    reviewNotes?: string;
    changeSummary: string;
    note?: string;
    reviewedChangeSet?: CommunityReviewedChangeSet;
  }
): Promise<CommunityReviewProposalDetail> =>
  requestData(
    {
      method: 'POST',
      path: `/api/community/review/proposals/${encodeURIComponent(proposalId)}/approve`,
      accessToken,
      body,
    },
    parseReviewProposalDetail
  );

export const rejectCommunityProposal = async (
  accessToken: string,
  proposalId: string,
  body: {
    reviewNotes: string;
  }
): Promise<CommunityReviewProposalDetail> =>
  requestData(
    {
      method: 'POST',
      path: `/api/community/review/proposals/${encodeURIComponent(proposalId)}/reject`,
      accessToken,
      body,
    },
    parseReviewProposalDetail
  );

export const generateCommunityProposalAiDraft = async (
  accessToken: string,
  proposalId: string
): Promise<CommunityReviewAiSuggestion> =>
  requestData(
    {
      method: 'POST',
      path: `/api/community/review/proposals/${encodeURIComponent(proposalId)}/ai-draft`,
      accessToken,
      body: {},
    },
    parseReviewAiSuggestion
  );

export const generateCommunityAnswerAiDraft = async (
  accessToken: string,
  questionId: string,
  answerId: string,
  body: {
    proposalTypeHint?: CommunityProposalType;
    title?: string;
    summary?: string;
  }
): Promise<CommunityReviewAiSuggestion> =>
  requestData(
    {
      method: 'POST',
      path: `/api/community/questions/${encodeURIComponent(questionId)}/answers/${encodeURIComponent(answerId)}/ai-draft`,
      accessToken,
      body,
    },
    parseReviewAiSuggestion
  );
