"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { ContestantStats } from "@/app/api/stats/route";

const noStore = { cache: "no-store" as RequestCache };

const SWR_OPTIONS = {
  revalidateOnFocus: true,
  revalidateIfStale: true,
  refreshInterval: 30000,
};

export interface PlayerCardContestant {
  id: string;
  name: string;
  starting_tribe: string;
  pre_merge_price: number;
  photo_url?: string;
  physicality?: number;
  cognition?: number;
  strategy?: number;
  influence?: number;
  resilience?: number;
}

export interface PlayerCardScores {
  total?: number;
  entries?: { contestant_id: string; is_wild_card?: boolean; added_at_episode: number; removed_at_episode?: number | null }[];
  all_entries?: { contestant_id: string; is_wild_card?: boolean; added_at_episode: number; removed_at_episode?: number | null }[];
  episode_count?: number;
  contestant_breakdowns?: unknown[];
  possessions?: Record<string, { idols: number; advantages: number; clues: number }>;
  contestant_tribes?: Record<string, string>;
}

async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, noStore);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

async function fetchStats(): Promise<ContestantStats[]> {
  const data = await fetcher<{ stats?: ContestantStats[] }>("/api/stats");
  const list = data.stats ?? [];
  if (list.length > 0) return list;
  const contestants = await fetcher<
    {
      id: string;
      name: string;
      starting_tribe: string;
      photo_url?: string;
      pre_merge_price?: number;
      physicality?: number;
      cognition?: number;
      strategy?: number;
      influence?: number;
      resilience?: number;
    }[]
  >("/api/contestants");
  if (!Array.isArray(contestants) || contestants.length === 0) return [];
  return contestants.map((c) => ({
    id: c.id,
    name: c.name,
    tribe: c.starting_tribe,
    starting_tribe: c.starting_tribe,
    photo_url: c.photo_url ?? "",
    price: c.pre_merge_price ?? 0,
    total_points: 0,
    latest_week_points: 0,
    challenges_won: 0,
    bonus_points: 0,
    confessional_points: 0,
    tribal_points: 0,
    advantage_points: 0,
    survival_points: 0,
    votes_received: 0,
    status: "active" as const,
    physicality: c.physicality ?? 50,
    cognition: c.cognition ?? 50,
    strategy: c.strategy ?? 50,
    influence: c.influence ?? 50,
    resilience: c.resilience ?? 50,
  }));
}

function statsToContestants(stats: ContestantStats[]): PlayerCardContestant[] {
  return stats.map((s) => ({
    id: s.id,
    name: s.name,
    starting_tribe: s.starting_tribe,
    pre_merge_price: s.price,
    photo_url: s.photo_url || undefined,
    physicality: s.physicality ?? 50,
    cognition: s.cognition ?? 50,
    strategy: s.strategy ?? 50,
    influence: s.influence ?? 50,
    resilience: s.resilience ?? 50,
  }));
}

export interface UsePlayerCardDataResult {
  data: {
    scores: PlayerCardScores | null;
    contestants: PlayerCardContestant[];
    season: { current_episode: number };
    captain: { picks: Record<number, string> };
  } | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Stable primitive for effect deps; same as data?.season?.current_episode ?? 1 */
  currentEpisode: number;
}

/**
 * Fetches data for player/roster cards the same way the Stats page does:
 * direct SWR requests to /api/scores, /api/stats, /api/season, /api/captain
 * so cards always show current stats (revalidateOnFocus, refreshInterval: 30s).
 */
export function usePlayerCardData(): UsePlayerCardDataResult {
  const { data: scores, isLoading: scoresLoading, mutate: mutateScores } = useSWR<PlayerCardScores>(
    "/api/scores",
    fetcher,
    SWR_OPTIONS
  );
  const { data: stats = [], isLoading: statsLoading, mutate: mutateStats } = useSWR<ContestantStats[]>(
    "/api/stats",
    fetchStats,
    SWR_OPTIONS
  );
  const { data: season, isLoading: seasonLoading, mutate: mutateSeason } = useSWR<{ current_episode?: number }>(
    "/api/season",
    fetcher,
    SWR_OPTIONS
  );
  const { data: captain, isLoading: captainLoading, mutate: mutateCaptain } = useSWR<{ picks?: Record<number, string> }>(
    "/api/captain",
    fetcher,
    SWR_OPTIONS
  );

  const loading = scoresLoading || statsLoading || seasonLoading || captainLoading;

  const currentEpisode = season?.current_episode ?? 1;

  const data = useMemo(() => {
    if (scores === undefined || season === undefined || captain === undefined) return null;
    return {
      scores: scores ?? null,
      contestants: statsToContestants(stats),
      season: { current_episode: season?.current_episode ?? 1 },
      captain: { picks: captain?.picks ?? {} },
    };
  }, [scores, stats, season, captain]);

  const refetch = async () => {
    await Promise.all([mutateScores(), mutateStats(), mutateSeason(), mutateCaptain()]);
  };

  return { data, loading, error: null, refetch, currentEpisode };
}
