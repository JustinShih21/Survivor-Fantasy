import { createClient } from "@/lib/supabase/server";
import type { TribeEntry } from "@/lib/scoring";
import { buildBreakdownsFromOverrides } from "@/lib/pointsFromOverrides";

interface StandingEntry {
  user_id: string;
  tribe_name: string;
  first_name: string;
  last_name: string;
  total_points: number;
}

export async function computeStandings(userIds: string[]): Promise<StandingEntry[]> {
  if (userIds.length === 0) return [];

  const supabase = await createClient();

  const [profilesRes, allEntriesRes, overridesRes, seasonRes] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, tribe_name").in("id", userIds),
    supabase
      .from("tribe_entries")
      .select("user_id, contestant_id, is_wild_card, added_at_episode, removed_at_episode")
      .in("user_id", userIds)
      .eq("phase", "pre_merge"),
    supabase
      .from("point_category_overrides")
      .select("contestant_id, episode_id, category, points"),
    supabase.from("season_state").select("current_episode").eq("id", "current").single(),
  ]);

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

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

  const entriesByUser = new Map<string, TribeEntry[]>();
  for (const r of allEntriesRes.data ?? []) {
    const list = entriesByUser.get(r.user_id) ?? [];
    list.push({
      contestant_id: r.contestant_id,
      is_wild_card: r.is_wild_card,
      added_at_episode: r.added_at_episode ?? 1,
      removed_at_episode: (r as { removed_at_episode?: number | null }).removed_at_episode ?? null,
    });
    entriesByUser.set(r.user_id, list);
  }

  const standings: StandingEntry[] = [];

  for (const uid of userIds) {
    const profile = profileMap.get(uid);
    if (!profile) continue;

    const userEntries = entriesByUser.get(uid) ?? [];
    if (userEntries.length === 0) continue;

    const { total } = buildBreakdownsFromOverrides(overrideRows, {
      rosterEntries: userEntries,
      episodeIds,
    });

    standings.push({
      user_id: uid,
      tribe_name: profile.tribe_name,
      first_name: profile.first_name,
      last_name: profile.last_name,
      total_points: total,
    });
  }

  standings.sort((a, b) => b.total_points - a.total_points);
  return standings;
}
