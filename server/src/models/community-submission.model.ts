import { createSupabaseUserClient } from "../config/supabase.js";
import type { Database } from "../types/database.js";
import { HttpError } from "../types/http-error.js";
import type { CreateCommunitySubmissionInput } from "../schemas/community-submission.schema.js";

type CommunitySubmissionRow = Database["public"]["Tables"]["community_submissions"]["Row"];

export interface CommunitySubmission {
    id: string;
    userId: string;
    submissionType: CommunitySubmissionRow['submission_type'];
    status: CommunitySubmissionRow['status'];
    title: string;
    payload: Record<string, unknown>;
    sourceContext: Record<string, unknown> | null;
    routeId?: string | null;
    routeVariantId?: string | null;
    reviewNotes: string | null;
    createdAt: string;
    updatedAt: string;
}

const mapCommunitySubmission = (row: CommunitySubmissionRow): CommunitySubmission => ({
    id: row.id,
    userId: row.user_id,
    submissionType: row.submission_type,
    status: row.status,
    title: row.title,
    payload: row.payload as Record<string, unknown>,
    sourceContext: row.source_context as Record<string, unknown> | null,
    routeId: row.route_id,
    routeVariantId: row.route_variant_id,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const createSubmission = async (
  payload: CreateCommunitySubmissionInput & { userId: string },
  accessToken: string
): Promise<CommunitySubmission> => {
  const client = createSupabaseUserClient(accessToken);
  const { data, error } = await client.rpc("create_community_submission_with_proposal", {
    p_user_id: payload.userId,
    p_submission_type: payload.submissionType,
    p_title: payload.title,
    p_payload: payload.payload,
    p_source_context: payload.sourceContext ?? null,
    p_route_id: payload.routeId ?? null,
    p_route_variant_id: payload.routeVariantId ?? null
  });

  if (error) {
    throw new HttpError(500, `Failed to create submission: ${error.message}`);
  }

  return mapCommunitySubmission(data as CommunitySubmissionRow);
};

export const findSubmissionsByUserId = async (
  userId: string,
  accessToken: string,
  status?: CommunitySubmissionRow["status"]
): Promise<CommunitySubmission[]> => {
  const client = createSupabaseUserClient(accessToken);
  let query = client.from("community_submissions").select("*").eq("user_id", userId);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new HttpError(500, `Failed to fetch submissions: ${error.message}`);
  }

  return ((data ?? []) as CommunitySubmissionRow[]).map(mapCommunitySubmission);
};
