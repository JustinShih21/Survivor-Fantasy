import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { computeStandings } from "@/lib/leaderboard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user_id } = auth;
  const { id: leagueId } = await params;

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, invite_code, created_by")
    .eq("id", leagueId)
    .single();

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", user_id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this league" }, { status: 403 });
  }

  const { data: members } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const standings = await computeStandings(memberIds);

  return NextResponse.json({
    league: {
      id: league.id,
      name: league.name,
      invite_code: league.invite_code,
      created_by: league.created_by,
    },
    standings,
    current_user_id: user_id,
  });
}
