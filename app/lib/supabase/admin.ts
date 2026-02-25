import { createClient } from "@supabase/supabase-js";

/**
 * Server-side only. Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 * Use only in admin API routes after verifying the request is from an admin.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Admin client not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}
