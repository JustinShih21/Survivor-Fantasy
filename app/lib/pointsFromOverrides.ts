/**
 * Build contestant breakdowns and totals from point_category_overrides only.
 * No episode_outcomes or scoring_config; admin updates are the sole source of points.
 */

import type { TribeEntry } from "./scoring";
import type { ContestantPointsSummary, ContestantEpisodeBreakdown } from "./scoring";

export type OverrideRow = {
  contestant_id: string;
  episode_id: number;
  category: string;
  points: number;
};

/** Build map: contestant_id:episode_id -> category -> points */
export function buildOverrideMap(
  rows: OverrideRow[]
): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const key = `${row.contestant_id}:${row.episode_id}`;
    let m = map.get(key);
    if (!m) {
      m = new Map();
      map.set(key, m);
    }
    m.set(row.category, row.points);
  }
  return map;
}

/** Episodes where contestant was on roster (added_at <= ep, removed_at null or >= ep) */
function rosterEpisodesForEntry(entry: TribeEntry, episodeIds: number[]): number[] {
  return episodeIds.filter((epId) => {
    if (entry.added_at_episode > epId) return false;
    const removed = entry.removed_at_episode ?? null;
    if (removed !== null && removed < epId) return false;
    return true;
  });
}

export interface BuildFromOverridesOptions {
  /** If provided, only these contestants and only episodes when on roster. */
  rosterEntries?: TribeEntry[];
  /** Episode IDs to include. If not provided, derived from override rows. */
  episodeIds?: number[];
}

/**
 * Build contestant_breakdowns and grand total from override rows only.
 * If rosterEntries is provided, only those contestants and only episodes when on roster.
 */
export function buildBreakdownsFromOverrides(
  overrideRows: OverrideRow[],
  options: BuildFromOverridesOptions = {}
): { contestant_breakdowns: ContestantPointsSummary[]; total: number } {
  const overrideMap = buildOverrideMap(overrideRows);
  const episodeIds =
    options.episodeIds ??
    [...new Set(overrideRows.map((r) => r.episode_id))].sort((a, b) => a - b);

  const contestantIds = options.rosterEntries
    ? [...new Set(options.rosterEntries.map((e) => e.contestant_id))]
    : [...new Set(overrideRows.map((r) => r.contestant_id))];

  const contestant_breakdowns: ContestantPointsSummary[] = [];
  let total = 0;

  for (const cid of contestantIds) {
    const entries = options.rosterEntries?.filter((e) => e.contestant_id === cid) ?? [];
    const episodesToInclude = options.rosterEntries
      ? entries.flatMap((e) => rosterEpisodesForEntry(e, episodeIds))
      : episodeIds;
    const uniqueEpisodes = [...new Set(episodesToInclude)].sort((a, b) => a - b);

    const episodes: ContestantEpisodeBreakdown[] = uniqueEpisodes.map((epId) => {
      const key = `${cid}:${epId}`;
      const catMap = overrideMap.get(key);
      const sources = catMap
        ? Array.from(catMap.entries()).map(([label, points]) => ({ label, points }))
        : [];
      const episodeTotal = sources.reduce((sum, s) => sum + s.points, 0);
      return {
        episode_id: epId,
        total: episodeTotal,
        sources,
        is_captain: false,
      };
    });

    const total_points = episodes.reduce((sum, ep) => sum + ep.total, 0);
    total += total_points;
    contestant_breakdowns.push({ contestant_id: cid, total_points, episodes });
  }

  return { contestant_breakdowns, total };
}
