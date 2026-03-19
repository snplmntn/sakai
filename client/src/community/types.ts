import type { PassengerType, RoutePreference } from '../routes/types';

export type CommunitySubmissionType =
  | 'missing_route'
  | 'route_correction'
  | 'fare_update'
  | 'route_note';

export type CommunitySubmissionStatus = 'pending' | 'reviewed' | 'approved' | 'rejected';

export interface CommunitySubmission {
  id: string;
  userId: string;
  submissionType: CommunitySubmissionType;
  status: CommunitySubmissionStatus;
  title: string;
  payload: Record<string, unknown>;
  sourceContext: Record<string, unknown> | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface CommunityQuestionDetail {
  question: CommunityQuestion;
  answers: CommunityQuestionAnswer[];
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
