import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/scores
 * Points come only from point_category_overrides (admin updates).
 * Query params: through=N (unused; kept for compatibility).
 */
export const dynamic = "force-dynamic";
import { getAuthenticatedUser } from "@/lib/getUser";
import type { TribeEntry } from "@/lib/scoring";
import { buildBreakdownsFromOverrides } from "@/lib/pointsFromOverrides";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { user_id, supabase } = auth;

    const [rosterRes, overridesRes, seasonRes, captainRes, possessionsRes] = await Promise.all([
      supabase
        .from("tribe_entries")
        .select("contestant_id, is_wild_card, added_at_episode, removed_at_episode")
        .eq("user_id", user_id)
        .eq("phase", "pre_merge")
        .order("added_at_episode"),
      supabase
        .from("point_category_overrides")
        .select("contestant_id, episode_id, category, points"),
      supabase.from("season_state").select("current_episode").eq("id", "current").single(),
      supabase.from("captain_picks").select("episode_id, contestant_id").eq("user_id", user_id),
      supabase.from("contestant_possessions").select("contestant_id, idols, advantages, clues"),
    ]);

    if (rosterRes.error) {
      return NextResponse.json({ error: rosterRes.error.message }, { status: 500 });
    }

    const allEntries: TribeEntry[] = (rosterRes.data ?? []).map((r) => ({
      contestant_id: r.contestant_id,
      is_wild_card: r.is_wild_card,
      added_at_episode: r.added_at_episode ?? 1,
      removed_at_episode: (r as { removed_at_episode?: number | null }).removed_at_episode ?? null,
    }));
    const entries = allEntries.filter((e) => e.removed_at_episode == null);

    const overrideRows = (overridesRes.data ?? []) as {
      contestant_id: string;
      episode_id: number;
      category: string;
      points: number;
    }[];

    const currentEpisode = seasonRes.data?.current_episode ?? 1;
    const episodeIds =
      overrideRows.length > 0
        ? [...new Set(overrideRows.map((r) => r.episode_id))].sort((a, b) => a - b)
        : Array.from({ length: Math.max(1, currentEpisode) }, (_, i) => i + 1);

    const { contestant_breakdowns, total: totalBeforeCaptain } = buildBreakdownsFromOverrides(overrideRows, {
      rosterEntries: allEntries,
      episodeIds,
    });

    const captainByEpisode = new Map<number, string>();
    for (const row of captainRes.data ?? []) {
      captainByEpisode.set(row.episode_id, row.contestant_id);
    }

    let total = 0;
    for (const b of contestant_breakdowns) {
      let breakdownTotal = 0;
      for (const ep of b.episodes) {
        const captainId = captainByEpisode.get(ep.episode_id);
        if (captainId === b.contestant_id) {
          ep.total *= 2;
          ep.is_captain = true;
        }
        breakdownTotal += ep.total;
      }
      b.total_points = breakdownTotal;
      total += breakdownTotal;
    }

    const possessions: Record<string, { idols: number; advantages: number; clues: number }> = {};
    for (const row of possessionsRes.data ?? []) {
      possessions[row.contestant_id] = {
        idols: row.idols ?? 0,
        advantages: row.advantages ?? 0,
        clues: row.clues ?? 0,
      };
    }

    return NextResponse.json({
      total,
      contestant_breakdowns,
      entries,
      all_entries: allEntries,
      episode_count: episodeIds.length,
      possessions,
      contestant_tribes: {} as Record<string, string>,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
