import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Secret-key Supabase client. Server-only. Bypasses RLS.
 * Only import this from route handlers / server actions that have already
 * verified the caller is an authenticated admin.
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
