import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";

export const dynamic = "force-dynamic";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user_id } = auth;

  const { data: memberships, error: memErr } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", user_id);

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  const leagueIds = (memberships ?? []).map((m) => m.league_id);

  if (leagueIds.length === 0) {
    return NextResponse.json({ leagues: [] });
  }

  const { data: leagues, error: leagueErr } = await supabase
    .from("leagues")
    .select("id, name, invite_code, created_by, created_at")
    .in("id", leagueIds);

  if (leagueErr) return NextResponse.json({ error: leagueErr.message }, { status: 500 });

  const { data: allMembers } = await supabase
    .from("league_members")
    .select("league_id, user_id")
    .in("league_id", leagueIds);

  const memberCounts: Record<string, number> = {};
  for (const m of allMembers ?? []) {
    memberCounts[m.league_id] = (memberCounts[m.league_id] ?? 0) + 1;
  }

  const result = (leagues ?? []).map((l) => ({
    ...l,
    member_count: memberCounts[l.id] ?? 0,
  }));

  return NextResponse.json({ leagues: result });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user_id } = auth;
  const body = (await request.json()) as { name?: string };

  if (!body.name || body.name.trim().length === 0) {
    return NextResponse.json({ error: "League name is required" }, { status: 400 });
  }

  const invite_code = generateInviteCode();

  const { data: league, error: createErr } = await supabase
    .from("leagues")
    .insert({ name: body.name.trim(), invite_code, created_by: user_id })
    .select("id, name, invite_code, created_by, created_at")
    .single();

  if (createErr) {
    if (createErr.message.includes("unique") || createErr.message.includes("duplicate")) {
      const retry_code = generateInviteCode();
      const { data: retryLeague, error: retryErr } = await supabase
        .from("leagues")
        .insert({ name: body.name.trim(), invite_code: retry_code, created_by: user_id })
        .select("id, name, invite_code, created_by, created_at")
        .single();
      if (retryErr) return NextResponse.json({ error: retryErr.message }, { status: 500 });

      await supabase.from("league_members").insert({ league_id: retryLeague!.id, user_id });
      return NextResponse.json({ league: { ...retryLeague, member_count: 1 } });
    }
    return NextResponse.json({ error: createErr.message }, { status: 500 });
  }

  const { error: joinErr } = await supabase
    .from("league_members")
    .insert({ league_id: league!.id, user_id });

  if (joinErr) return NextResponse.json({ error: joinErr.message }, { status: 500 });

  return NextResponse.json({ league: { ...league, member_count: 1 } });
}
