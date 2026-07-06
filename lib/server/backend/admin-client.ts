import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Secret-key backend client. Server-only. Bypasses RLS.
 * Only import this from route handlers that have already verified the caller.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
