import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getEnv } from "./env.js";
import type { Database } from "../types/database.js";

let supabaseAdminClient: SupabaseClient<Database> | null = null;

export const getSupabaseAdminClient = (): SupabaseClient<Database> => {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const env = getEnv();

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
