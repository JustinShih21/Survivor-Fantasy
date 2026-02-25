import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function getAdminClient() {
  try {
    return createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Admin client not configured")) {
      return null;
    }
    throw e;
  }
}

export interface PointsBreakdownSource {
  label: string;
  points: number;
  isOverride: boolean;
}

export interface ContestantBreakdownForEpisode {
  contestant_id: string;
  total: number;
  sources: PointsBreakdownSource[];
}

/**
 * GET /api/admin/points-breakdown?episode_id=N
 * Returns for the given episode: all contestants and each contestant's point breakdown
 * from point_category_overrides only (admin updates are the sole source of points).
 */
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const episodeIdParam = searchParams.get("episode_id");
  const episodeId = episodeIdParam != null ? parseInt(episodeIdParam, 10) : 1;
  if (Number.isNaN(episodeId) || episodeId < 1) {
    return NextResponse.json({ error: "Valid episode_id required" }, { status: 400 });
  }

  const [contestantsRes, overridesRes] = await Promise.all([
    admin.from("contestants").select("id, name").order("id"),
    admin.from("point_category_overrides").select("contestant_id, episode_id, category, points").eq("episode_id", episodeId),
  ]);

  if (contestantsRes.error) {
    return NextResponse.json({ error: contestantsRes.error.message }, { status: 500 });
  }

  const contestants = (contestantsRes.data ?? []) as { id: string; name: string }[];
  const overrideRows = (overridesRes.data ?? []) as { contestant_id: string; episode_id: number; category: string; points: number }[];

  const overrideByContestant = new Map<string, Map<string, number>>();
  for (const row of overrideRows) {
    let m = overrideByContestant.get(row.contestant_id);
    if (!m) {
      m = new Map();
      overrideByContestant.set(row.contestant_id, m);
    }
    m.set(row.category, row.points);
  }

  const breakdowns: ContestantBreakdownForEpisode[] = contestants.map((c) => {
    const overrides = overrideByContestant.get(c.id);
    const sources: PointsBreakdownSource[] = overrides
      ? Array.from(overrides.entries()).map(([label, points]) => ({ label, points, isOverride: true }))
      : [];
    const total = sources.reduce((sum, s) => sum + s.points, 0);
    return { contestant_id: c.id, total, sources };
  });

  return NextResponse.json({
    episode_id: episodeId,
    contestants,
    breakdowns,
  });
}
