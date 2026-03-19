import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getEnv } from "./env.js";
import type { Database } from "../types/database.js";

let supabaseAdminClient: SupabaseClient<Database> | null = null;

const decodeJwtPayload = (token: string) => {
  const segments = token.split(".");

  if (segments.length < 2) {
    throw new Error("Supabase key is not a valid JWT");
  }

  const base64 = segments[1]
    ?.replace(/-/g, "+")
    .replace(/_/g, "/");

  if (!base64) {
    throw new Error("Supabase key payload is missing");
  }

  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const payloadText = Buffer.from(padded, "base64").toString("utf8");

  return JSON.parse(payloadText) as {
    role?: string;
  };
};

export const getSupabaseAdminClient = (): SupabaseClient<Database> => {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const env = getEnv();
  const serviceRolePayload = decodeJwtPayload(env.SUPABASE_SERVICE_ROLE_KEY);

  if (serviceRolePayload.role !== "service_role") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be a Supabase service_role key. The current key does not have role=service_role."
    );
  }

  supabaseAdminClient = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return supabaseAdminClient;
};

export const createSupabaseAuthClient = (): SupabaseClient<Database> => {
  const env = getEnv();

  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
};

export const createSupabaseUserClient = (
  accessToken: string
): SupabaseClient<Database> => {
  const env = getEnv();

  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
};
