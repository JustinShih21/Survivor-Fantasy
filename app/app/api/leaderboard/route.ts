import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { computeStandings } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user_id } = auth;

  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id");

  const allUserIds = (allProfiles ?? []).map((p) => p.id);

  const standings = await computeStandings(allUserIds);

  return NextResponse.json({
    standings,
    current_user_id: user_id,
  });
}
