import { createSupabaseUserClient } from "../config/supabase.js";
import type { Database } from "../types/database.js";
import { HttpError } from "../types/http-error.js";
import type { CreateCommunitySubmissionInput } from "../schemas/community-submission.schema.js";

type CommunitySubmissionRow = Database["public"]["Tables"]["community_submissions"]["Row"];
type CommunitySubmissionInsert = Database["public"]["Tables"]["community_submissions"]["Insert"];

export interface CommunitySubmission {
    id: string;
    userId: string;
    submissionType: CommunitySubmissionRow['submission_type'];
    status: CommunitySubmissionRow['status'];
    title: string;
    payload: Record<string, unknown>;
    sourceContext: Record<string, unknown> | null;
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
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const createSubmission = async (
    payload: CreateCommunitySubmissionInput & { userId: string },
    accessToken: string
): Promise<CommunitySubmission> => {
    const client = createSupabaseUserClient(accessToken);
    
    const record: CommunitySubmissionInsert = {
        user_id: payload.userId,
        submission_type: payload.submissionType,
        title: payload.title,
        payload: payload.payload,
        source_context: payload.sourceContext,
    };

    const { data, error } = await client
        .from("community_submissions")
        .insert(record)
        .select("*")
        .single();

    if (error) {
        throw new HttpError(500, `Failed to create submission: ${error.message}`);
    }

    return mapCommunitySubmission(data as CommunitySubmissionRow);
};

export const findSubmissionsByUserId = async (
    userId: string,
    accessToken: string,
    status?: CommunitySubmissionRow['status']
): Promise<CommunitySubmission[]> => {
    const client = createSupabaseUserClient(accessToken);
    let query = client
        .from("community_submissions")
        .select("*")
        .eq("user_id", userId);

    if (status) {
        query = query.eq("status", status);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
        throw new HttpError(500, `Failed to fetch submissions: ${error.message}`);
    }

    return ((data ?? []) as CommunitySubmissionRow[]).map(mapCommunitySubmission);
};
