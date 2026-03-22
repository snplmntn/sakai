import { createSupabaseUserClient, getSupabaseAdminClient } from "../config/supabase.js";
import type {
  CreateCommunityAnswerInput,
  CreateCommunityQuestionInput
} from "../schemas/community-question.schema.js";
import type { Database } from "../types/database.js";
import { HttpError } from "../types/http-error.js";

type QuestionRow = Database["public"]["Tables"]["community_questions"]["Row"];
type QuestionInsert = Database["public"]["Tables"]["community_questions"]["Insert"];
type AnswerRow = Database["public"]["Tables"]["community_question_answers"]["Row"];
type AnswerInsert = Database["public"]["Tables"]["community_question_answers"]["Insert"];
type QuestionPreference = Database["public"]["Tables"]["community_questions"]["Row"]["preference"];
type QuestionPassengerType =
  Database["public"]["Tables"]["community_questions"]["Row"]["passenger_type"];

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
  preference: QuestionPreference;
  passengerType: QuestionPassengerType;
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
  promotionStatus: AnswerRow["promotion_status"];
  linkedRouteId: string | null;
  linkedRouteVariantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityQuestionDetail {
  question: CommunityQuestion;
  answers: CommunityQuestionAnswer[];
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const mapQuestion = (row: QuestionRow): CommunityQuestion => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  body: row.body,
  originLabel: row.origin_label,
  destinationLabel: row.destination_label,
  originPlaceId: row.origin_place_id,
  destinationPlaceId: row.destination_place_id,
  routeQueryText: row.route_query_text,
  preference: row.preference,
  passengerType: row.passenger_type,
  sourceContext: asRecord(row.source_context),
  replyCount: row.reply_count,
  lastAnsweredAt: row.last_answered_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapAnswer = (row: AnswerRow): CommunityQuestionAnswer => ({
  id: row.id,
  questionId: row.question_id,
  userId: row.user_id,
  body: row.body,
  helpfulCount: row.helpful_count,
  promotionStatus: row.promotion_status,
  linkedRouteId: row.linked_route_id,
  linkedRouteVariantId: row.linked_route_variant_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const createQuestion = async (
  payload: CreateCommunityQuestionInput & { userId: string },
  accessToken: string
): Promise<CommunityQuestion> => {
  const client = createSupabaseUserClient(accessToken);
  const record: QuestionInsert = {
    user_id: payload.userId,
    title: payload.title,
    body: payload.body,
    origin_label: payload.originLabel,
    destination_label: payload.destinationLabel,
    origin_place_id: payload.originPlaceId,
    destination_place_id: payload.destinationPlaceId,
    route_query_text: payload.routeQueryText,
    preference: payload.preference,
    passenger_type: payload.passengerType,
    source_context: payload.sourceContext
  };

  const { data, error } = await client
    .from("community_questions")
    .insert(record)
    .select("*")
    .single();

  if (error) {
    throw new HttpError(500, `Failed to create question: ${error.message}`);
  }

  return mapQuestion(data);
};

export const listQuestionsByUserId = async (
  userId: string,
  accessToken: string
): Promise<CommunityQuestion[]> => {
  const client = createSupabaseUserClient(accessToken);
  const { data, error } = await client
    .from("community_questions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, `Failed to fetch questions: ${error.message}`);
  }

  return (data ?? []).map(mapQuestion);
};

export const listRecentQuestions = async (
  accessToken: string,
  limit = 10
): Promise<CommunityQuestion[]> => {
  const client = createSupabaseUserClient(accessToken);
  const { data, error } = await client
    .from("community_questions")
    .select("*")
    .order("last_answered_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new HttpError(500, `Failed to fetch recent questions: ${error.message}`);
  }

  return (data ?? []).map(mapQuestion);
};

export const getQuestionDetail = async (
  questionId: string,
  accessToken: string
): Promise<CommunityQuestionDetail> => {
  const client = createSupabaseUserClient(accessToken);
  const [{ data: question, error: questionError }, { data: answers, error: answersError }] =
    await Promise.all([
      client.from("community_questions").select("*").eq("id", questionId).maybeSingle(),
      client
        .from("community_question_answers")
        .select("*")
        .eq("question_id", questionId)
        .order("created_at", { ascending: true })
    ]);

  if (questionError) {
    throw new HttpError(500, `Failed to fetch question: ${questionError.message}`);
  }

  if (!question) {
    throw new HttpError(404, "Community question not found");
  }

  if (answersError) {
    throw new HttpError(500, `Failed to fetch question answers: ${answersError.message}`);
  }

  return {
    question: mapQuestion(question),
    answers: (answers ?? []).map(mapAnswer)
  };
};

export const createAnswer = async (
  questionId: string,
  payload: CreateCommunityAnswerInput & { userId: string },
  accessToken: string
): Promise<CommunityQuestionAnswer> => {
  const userClient = createSupabaseUserClient(accessToken);
  const record: AnswerInsert = {
    question_id: questionId,
    user_id: payload.userId,
    body: payload.body
  };

  const { data, error } = await userClient
    .from("community_question_answers")
    .insert(record)
    .select("*")
    .single();

  if (error) {
    throw new HttpError(500, `Failed to create answer: ${error.message}`);
  }

  const adminClient = getSupabaseAdminClient();
  const { data: question, error: questionError } = await adminClient
    .from("community_questions")
    .select("reply_count")
    .eq("id", questionId)
    .maybeSingle();

  if (questionError) {
    throw new HttpError(500, `Failed to load question reply count: ${questionError.message}`);
  }

  if (!question) {
    throw new HttpError(404, "Community question not found");
  }

  const { error: updateError } = await adminClient
    .from("community_questions")
    .update({
      reply_count: question.reply_count + 1,
      last_answered_at: new Date().toISOString()
    })
    .eq("id", questionId);

  if (updateError) {
    throw new HttpError(500, `Failed to update question reply count: ${updateError.message}`);
  }

  return mapAnswer(data);
};
