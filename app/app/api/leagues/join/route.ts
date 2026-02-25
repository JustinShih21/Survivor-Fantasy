import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user_id } = auth;
  const body = (await request.json()) as { code?: string };

  const code = body.code?.trim().toUpperCase();
  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
  }

  const { data: league, error: lookupErr } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("invite_code", code)
    .single();

  if (lookupErr || !league) {
    return NextResponse.json({ error: "Invalid invite code — no league found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", user_id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "You are already a member of this league", league_name: league.name }, { status: 409 });
  }

  const { error: joinErr } = await supabase
    .from("league_members")
    .insert({ league_id: league.id, user_id });

  if (joinErr) return NextResponse.json({ error: joinErr.message }, { status: 500 });

  return NextResponse.json({ success: true, league_id: league.id, league_name: league.name });
}
