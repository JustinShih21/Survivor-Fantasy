import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { user_id, supabase } = auth;

  const { data, error } = await supabase
    .from("tribe_entries")
    .select("contestant_id, is_wild_card, added_at_episode, removed_at_episode")
    .eq("user_id", user_id)
    .eq("phase", "pre_merge")
    .order("added_at_episode");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entries = (data ?? [])
    .filter((r) => (r as { removed_at_episode?: number | null }).removed_at_episode == null)
    .map((r) => ({
    contestant_id: r.contestant_id,
    is_wild_card: r.is_wild_card,
    added_at_episode: r.added_at_episode ?? 1,
  }));

  return NextResponse.json({ entries });
}
