import { createClient } from "@/lib/supabase/server";
import type { TribeEntry } from "@/lib/scoring";

interface StandingEntry {
  user_id: string;
  tribe_name: string;
  first_name: string;
  last_name: string;
  total_points: number;
}

function rosterEpisodesForEntry(
  entry: TribeEntry,
  episodeIds: number[]
): number[] {
  return episodeIds.filter((epId) => {
    if (entry.added_at_episode > epId) return false;
    const removed = entry.removed_at_episode ?? null;
    if (removed !== null && removed < epId) return false;
    return true;
  });
}

export async function computeStandings(
  userIds: string[]
): Promise<StandingEntry[]> {
  if (userIds.length === 0) return [];

  const supabase = await createClient();

  const [profilesRes, allEntriesRes, seasonRes, captainRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, tribe_name")
      .in("id", userIds),
    supabase
      .from("tribe_entries")
      .select(
        "user_id, contestant_id, is_wild_card, added_at_episode, removed_at_episode"
      )
      .in("user_id", userIds)
      .eq("phase", "pre_merge"),
    supabase
      .from("season_state")
      .select("current_episode")
      .eq("id", "current")
      .single(),
    supabase
      .from("captain_picks")
      .select("user_id, episode_id, contestant_id")
      .in("user_id", userIds),
  ]);

  const currentEpisode =
    (seasonRes.data as { current_episode?: number } | null)?.current_episode ?? 1;

  const pointsRes = await supabase
    .from("contestant_episode_points")
    .select("episode_id, contestant_id, total_points")
    .lte("episode_id", currentEpisode)
    .order("episode_id")
    .order("contestant_id");
  const episodeIds = Array.from(
    { length: Math.max(1, currentEpisode) },
    (_, i) => i + 1
  );

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [
      p.id,
      p as { id: string; first_name: string; last_name: string; tribe_name: string },
    ])
  );

  const entriesByUser = new Map<string, TribeEntry[]>();
  for (const r of allEntriesRes.data ?? []) {
    const row = r as {
      user_id: string;
      contestant_id: string;
      is_wild_card?: boolean;
      added_at_episode: number;
      removed_at_episode?: number | null;
    };
    const list = entriesByUser.get(row.user_id) ?? [];
    list.push({
      contestant_id: row.contestant_id,
      is_wild_card: row.is_wild_card ?? false,
      added_at_episode: row.added_at_episode ?? 1,
      removed_at_episode: row.removed_at_episode ?? null,
    });
    entriesByUser.set(row.user_id, list);
  }

  const captainByUserAndEpisode = new Map<string, string>();
  for (const row of captainRes.data ?? []) {
    const r = row as { user_id: string; episode_id: number; contestant_id: string };
    captainByUserAndEpisode.set(`${r.user_id}:${r.episode_id}`, r.contestant_id);
  }

  const pointsByKey = new Map<string, number>();
  for (const row of pointsRes.data ?? []) {
    const r = row as {
      episode_id: number;
      contestant_id: string;
      total_points: number;
    };
    pointsByKey.set(`${r.contestant_id}:${r.episode_id}`, r.total_points);
  }

  const standings: StandingEntry[] = [];

  for (const uid of userIds) {
    const profile = profileMap.get(uid);
    if (!profile) continue;

    const userEntries = entriesByUser.get(uid) ?? [];
    if (userEntries.length === 0) continue;

    let total = 0;
    for (const entry of userEntries) {
      const episodes = rosterEpisodesForEntry(entry, episodeIds);
      for (const epId of episodes) {
        let pts = pointsByKey.get(`${entry.contestant_id}:${epId}`) ?? 0;
        const captainId = captainByUserAndEpisode.get(`${uid}:${epId}`);
        if (captainId === entry.contestant_id) {
          pts *= 2;
        }
        total += pts;
      }
    }

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
