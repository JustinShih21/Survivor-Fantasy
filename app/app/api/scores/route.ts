import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/scores
 * Reads from canonical contestant_episode_points. Builds contestant_breakdowns from stored data + captain 2x.
 */
export const dynamic = "force-dynamic";
import { getAuthenticatedUser } from "@/lib/getUser";
import type { TribeEntry } from "@/lib/scoring";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { user_id, supabase } = auth;

    const [rosterRes, seasonRes, captainRes, possessionsRes] = await Promise.all([
      supabase
        .from("tribe_entries")
        .select("contestant_id, is_wild_card, added_at_episode, removed_at_episode")
        .eq("user_id", user_id)
        .eq("phase", "pre_merge")
        .order("added_at_episode"),
      supabase
        .from("season_state")
        .select("current_episode")
        .eq("id", "current")
        .single(),
      supabase
        .from("captain_picks")
        .select("episode_id, contestant_id")
        .eq("user_id", user_id),
      supabase
        .from("contestant_possessions")
        .select("contestant_id, idols, advantages, clues"),
    ]);

    if (rosterRes.error) {
      return NextResponse.json({ error: rosterRes.error.message }, { status: 500 });
    }

    const currentEpisode =
      (seasonRes.data as { current_episode?: number } | null)?.current_episode ?? 1;

    const pointsRes = await supabase
      .from("contestant_episode_points")
      .select("episode_id, contestant_id, total_points, breakdown")
      .lte("episode_id", currentEpisode)
      .order("episode_id")
      .order("contestant_id");

    const allEntries: TribeEntry[] = (rosterRes.data ?? []).map((r) => ({
      contestant_id: r.contestant_id,
      is_wild_card: r.is_wild_card,
      added_at_episode: r.added_at_episode ?? 1,
      removed_at_episode: (r as { removed_at_episode?: number | null })
        .removed_at_episode ?? null,
    }));
    const entries = allEntries.filter((e) => e.removed_at_episode == null);

    const episodeIds = Array.from(
      { length: Math.max(1, currentEpisode) },
      (_, i) => i + 1
    );

    const captainByEpisode = new Map<number, string>();
    for (const row of captainRes.data ?? []) {
      captainByEpisode.set(
        (row as { episode_id: number; contestant_id: string }).episode_id,
        (row as { episode_id: number; contestant_id: string }).contestant_id
      );
    }

    const pointsRows = (pointsRes.data ?? []) as {
      episode_id: number;
      contestant_id: string;
      total_points: number;
      breakdown: Record<string, number>;
    }[];

    const pointsByKey = new Map<string, { total: number; breakdown: Record<string, number> }>();
    for (const r of pointsRows) {
      pointsByKey.set(`${r.contestant_id}:${r.episode_id}`, {
        total: r.total_points,
        breakdown: (r.breakdown as Record<string, number>) ?? {},
      });
    }

    const contestant_breakdowns: {
      contestant_id: string;
      total_points: number;
      episodes: {
        episode_id: number;
        total: number;
        sources: { label: string; points: number }[];
        is_captain: boolean;
      }[];
    }[] = [];

    const contestantIds = [...new Set(allEntries.map((e) => e.contestant_id))];

    for (const cid of contestantIds) {
      const rosterEntriesForC = allEntries.filter((e) => e.contestant_id === cid);
      const episodesToInclude = new Set<number>();
      for (const entry of rosterEntriesForC) {
        for (const epId of episodeIds) {
          if (entry.added_at_episode > epId) continue;
          const removed = entry.removed_at_episode ?? null;
          if (removed !== null && removed < epId) continue;
          episodesToInclude.add(epId);
        }
      }

      const sortedEpisodes = [...episodesToInclude].sort((a, b) => a - b);
      let total_points = 0;
      const episodes: {
        episode_id: number;
        total: number;
        sources: { label: string; points: number }[];
        is_captain: boolean;
      }[] = [];

      for (const epId of sortedEpisodes) {
        const stored = pointsByKey.get(`${cid}:${epId}`);
        let episodeTotal = stored?.total ?? 0;
        const sources = stored?.breakdown
          ? Object.entries(stored.breakdown).map(([label, points]) => ({
              label,
              points,
            }))
          : [];
        const captainId = captainByEpisode.get(epId);
        const is_captain = captainId === cid;
        if (is_captain) {
          episodeTotal *= 2;
          for (const s of sources) {
            s.points *= 2;
          }
        }
        total_points += episodeTotal;
        episodes.push({
          episode_id: epId,
          total: episodeTotal,
          sources,
          is_captain,
        });
      }

      contestant_breakdowns.push({ contestant_id: cid, total_points, episodes });
    }

    const total = contestant_breakdowns.reduce((sum, b) => sum + b.total_points, 0);

    const possessions: Record<
      string,
      { idols: number; advantages: number; clues: number }
    > = {};
    for (const row of possessionsRes.data ?? []) {
      const r = row as {
        contestant_id: string;
        idols?: number;
        advantages?: number;
        clues?: number;
      };
      possessions[r.contestant_id] = {
        idols: r.idols ?? 0,
        advantages: r.advantages ?? 0,
        clues: r.clues ?? 0,
      };
    }

    return NextResponse.json(
      {
        total,
        contestant_breakdowns,
        entries,
        all_entries: allEntries,
        episode_count: episodeIds.length,
        possessions,
        contestant_tribes: {} as Record<string, string>,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
