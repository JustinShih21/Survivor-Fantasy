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
 * Returns for the given episode: all contestants and each contestant's point breakdown.
 * Primary source: contestant_episode_points (canonical). Fallback: point_category_overrides
 * when the canonical table has no rows for this episode (e.g. before first materialize).
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

  const [contestantsRes, pointsRes] = await Promise.all([
    admin.from("contestants").select("id, name").order("id"),
    admin
      .from("contestant_episode_points")
      .select("contestant_id, total_points, breakdown")
      .eq("episode_id", episodeId),
  ]);

  if (contestantsRes.error) {
    return NextResponse.json({ error: contestantsRes.error.message }, { status: 500 });
  }

  const contestants = (contestantsRes.data ?? []) as { id: string; name: string }[];
  const pointsRows = (pointsRes.data ?? []) as {
    contestant_id: string;
    total_points: number;
    breakdown: Record<string, number>;
  }[];

  if (pointsRows.length === 0) {
    return respondFromOverrides(admin, episodeId, contestants);
  }

  const pointsByContestant = new Map(
    pointsRows.map((r) => [
      r.contestant_id,
      { total: r.total_points, breakdown: r.breakdown ?? {} },
    ])
  );

  const breakdowns: ContestantBreakdownForEpisode[] = contestants.map((c) => {
    const row = pointsByContestant.get(c.id);
    const total = row?.total ?? 0;
    const breakdown = row?.breakdown ?? {};
    const sources: PointsBreakdownSource[] = Object.entries(breakdown).map(
      ([label, points]) => ({ label, points, isOverride: false })
    );
    return { contestant_id: c.id, total, sources };
  });

  return NextResponse.json({
    episode_id: episodeId,
    contestants,
    breakdowns,
  });
}

async function respondFromOverrides(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  episodeId: number,
  contestants: { id: string; name: string }[]
) {
  const overridesRes = await admin
    .from("point_category_overrides")
    .select("contestant_id, episode_id, category, points")
    .eq("episode_id", episodeId);

  const overrideRows = (overridesRes.data ?? []) as {
    contestant_id: string;
    episode_id: number;
    category: string;
    points: number;
  }[];

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
      ? Array.from(overrides.entries()).map(([label, points]) => ({
          label,
          points,
          isOverride: true,
        }))
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
