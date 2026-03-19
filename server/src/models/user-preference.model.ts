import {
  createSupabaseUserClient,
  getSupabaseAdminClient
} from "../config/supabase.js";
import { HttpError } from "../types/http-error.js";
import type { Database } from "../types/database.js";

type UserPreferenceRow = Database["public"]["Tables"]["user_preferences"]["Row"];
type UserPreferenceInsert = Database["public"]["Tables"]["user_preferences"]["Insert"];

export type RoutePreference = UserPreferenceRow["default_preference"];
export type PassengerType = UserPreferenceRow["passenger_type"];

export interface UserPreference {
  userId: string;
  defaultPreference: RoutePreference;
  passengerType: PassengerType;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertUserPreferenceInput {
  userId: string;
  defaultPreference: RoutePreference;
  passengerType: PassengerType;
}

const mapUserPreference = (row: UserPreferenceRow): UserPreference => ({
  userId: row.user_id,
  defaultPreference: row.default_preference,
  passengerType: row.passenger_type,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const getUserPreferenceByUserId = async (
  userId: string,
  accessToken?: string
): Promise<UserPreference | null> => {
  const client = accessToken
    ? createSupabaseUserClient(accessToken)
    : getSupabaseAdminClient();
  const { data, error } = await client
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `Failed to fetch user preferences: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapUserPreference(data as UserPreferenceRow);
};

export const upsertUserPreference = async (
  payload: UpsertUserPreferenceInput,
  accessToken?: string
): Promise<UserPreference> => {
  const client = accessToken
    ? createSupabaseUserClient(accessToken)
    : getSupabaseAdminClient();
  const record: UserPreferenceInsert = {
    user_id: payload.userId,
    default_preference: payload.defaultPreference,
    passenger_type: payload.passengerType
  };
  const { data, error } = await client
    .from("user_preferences")
    .upsert(record, {
      onConflict: "user_id"
    })
    .select("*")
    .single();

  if (error) {
    throw new HttpError(500, `Failed to save user preferences: ${error.message}`);
  }

  return mapUserPreference(data as UserPreferenceRow);
};
