/**
 * Materialize contestant points per episode into contestant_episode_points.
 * Reads point_category_overrides (and point_overrides as total override) and UPSERTs
 * one row per (episode_id, contestant_id) with total_points and breakdown JSONB.
 * Use admin client for writes (bypasses RLS).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOverrideMap } from "@/lib/pointsFromOverrides";
import type { OverrideRow } from "@/lib/pointsFromOverrides";

export async function materializePointsForEpisode(
  episodeId: number,
  admin: SupabaseClient
): Promise<{ episodeId: number; rowCount: number }> {
  const [overridesRes, totalOverridesRes] = await Promise.all([
    admin
      .from("point_category_overrides")
      .select("contestant_id, episode_id, category, points")
      .eq("episode_id", episodeId),
    admin
      .from("point_overrides")
      .select("contestant_id, episode_id, points")
      .eq("episode_id", episodeId),
  ]);

  const overrideRows = (overridesRes.data ?? []) as OverrideRow[];
  const totalOverrideRows = (totalOverridesRes.data ?? []) as {
    contestant_id: string;
    episode_id: number;
    points: number;
  }[];

  const totalOverrideByContestant = new Map(
    totalOverrideRows.map((r) => [r.contestant_id, r.points])
  );

  const overrideMap = buildOverrideMap(overrideRows);

  const contestantIds = [
    ...new Set([
      ...overrideRows.map((r) => r.contestant_id),
      ...totalOverrideRows.map((r) => r.contestant_id),
    ]),
  ];

  if (contestantIds.length === 0) {
    return { episodeId, rowCount: 0 };
  }

  const rows: {
    episode_id: number;
    contestant_id: string;
    total_points: number;
    breakdown: Record<string, number>;
  }[] = [];

  for (const contestant_id of contestantIds) {
    const key = `${contestant_id}:${episodeId}`;
    const catMap = overrideMap.get(key);
    const totalOverride = totalOverrideByContestant.get(contestant_id);

    const breakdown: Record<string, number> = catMap
      ? Object.fromEntries(catMap.entries())
      : {};
    const total_points =
      totalOverride !== undefined
        ? totalOverride
        : Object.values(breakdown).reduce((s, p) => s + p, 0);

    rows.push({
      episode_id: episodeId,
      contestant_id,
      total_points,
      breakdown,
    });
  }

  const { error } = await admin
    .from("contestant_episode_points")
    .upsert(
      rows.map((r) => ({
        episode_id: r.episode_id,
        contestant_id: r.contestant_id,
        total_points: r.total_points,
        breakdown: r.breakdown,
      })),
      { onConflict: "episode_id,contestant_id", ignoreDuplicates: false }
    );

  if (error) throw new Error(`materializePoints episode ${episodeId}: ${error.message}`);

  return { episodeId, rowCount: rows.length };
}

/**
 * Materialize points for multiple episodes (e.g. all episodes that have overrides).
 */
export async function materializePointsForEpisodes(
  episodeIds: number[],
  admin: SupabaseClient
): Promise<{ episodeCount: number; rowCount: number }> {
  let rowCount = 0;
  for (const epId of episodeIds) {
    const result = await materializePointsForEpisode(epId, admin);
    rowCount += result.rowCount;
  }
  return { episodeCount: episodeIds.length, rowCount };
}
