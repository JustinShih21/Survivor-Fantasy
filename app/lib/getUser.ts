import { createClient } from "@/lib/supabase/server";

/**
 * Get the authenticated user from the current request context.
 * Returns { user_id, supabase } or null if not authenticated.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return { user_id: user.id, supabase };
}
