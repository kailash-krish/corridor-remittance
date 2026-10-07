import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

// Service-role Supabase client for backend operations bypassing RLS when needed
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);
