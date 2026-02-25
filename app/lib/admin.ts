import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true if the current user (from supabase.auth.getUser()) is in ADMIN_USER_IDS.
 * ADMIN_USER_IDS is a comma-separated list of UUIDs in env.
 */
export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const idsEnv = process.env.ADMIN_USER_IDS;
  if (!idsEnv || typeof idsEnv !== "string") return false;

  const ids = idsEnv.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(user.id);
}
