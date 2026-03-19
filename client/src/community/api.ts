import { isRecord, requestData } from '../api/base';
import type {
  CommunityQuestion,
  CommunityQuestionAnswer,
  CommunityQuestionDetail,
  CommunitySubmission,
  CommunitySubmissionStatus,
  CommunitySubmissionType,
} from './types';

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
    submissionType !== 'route_note'
  ) {
    throw new Error('Invalid submissionType in community response');
  }

  return submissionType;
};

const parseSubmissionStatus = (value: unknown): CommunitySubmissionStatus => {
  const status = parseString(value, 'status');

  if (status !== 'pending' && status !== 'reviewed' && status !== 'approved' && status !== 'rejected') {
    throw new Error('Invalid submission status in community response');
  }

  return status;
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
    createdAt: parseString(value.createdAt, 'createdAt'),
    updatedAt: parseString(value.updatedAt, 'updatedAt'),
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
