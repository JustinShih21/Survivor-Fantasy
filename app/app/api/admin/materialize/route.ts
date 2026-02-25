/**
 * POST /api/admin/materialize
 * Admin-only. Runs price and points materialization for the current episode range.
 * Use after migration backfill or when episode_outcomes / overrides are updated outside the app.
 */
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { materializePricesForEpisodes } from "@/lib/materializePrices";
import { materializePointsForEpisode } from "@/lib/materializePoints";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Admin client not configured")) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
    }
    throw e;
  }

  try {
    const { data: seasonRow } = await admin
      .from("season_state")
      .select("current_episode")
      .eq("id", "current")
      .single();

    const currentEpisode = Math.max(1, seasonRow?.current_episode ?? 1);

    const priceResult = await materializePricesForEpisodes(currentEpisode, admin);

    const { data: overrideEpisodes } = await admin
      .from("point_category_overrides")
      .select("episode_id")
      .then((r) => ({ data: r.data ?? [], error: r.error }));

    const episodeIds =
      overrideEpisodes.length > 0
        ? [...new Set((overrideEpisodes as { episode_id: number }[]).map((r) => r.episode_id))].sort(
            (a, b) => a - b
          )
        : Array.from({ length: currentEpisode }, (_, i) => i + 1);

    let pointsRowCount = 0;
    for (const epId of episodeIds) {
      const result = await materializePointsForEpisode(epId, admin);
      pointsRowCount += result.rowCount;
    }

    return NextResponse.json({
      ok: true,
      prices: { episodeCount: priceResult.episodeCount, rowCount: priceResult.rowCount },
      points: { episodeCount: episodeIds.length, rowCount: pointsRowCount },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Materialization failed" },
      { status: 500 }
    );
  }
}
