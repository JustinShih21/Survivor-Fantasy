"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export interface AppDataScores {
  total?: number;
  entries?: { contestant_id: string; is_wild_card?: boolean; added_at_episode: number; removed_at_episode?: number | null }[];
  all_entries?: { contestant_id: string; is_wild_card?: boolean; added_at_episode: number; removed_at_episode?: number | null }[];
  episode_count?: number;
  contestant_breakdowns?: unknown[];
  possessions?: Record<string, { idols: number; advantages: number; clues: number }>;
  contestant_tribes?: Record<string, string>;
  [key: string]: unknown;
}

export interface AppDataContestant {
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

export interface AppData {
  scores: AppDataScores | null;
  contestants: AppDataContestant[];
  season: { current_episode?: number };
  captain: { picks?: Record<number, string> };
  isAdmin?: boolean;
}

interface AppDataContextValue {
  data: AppData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const defaultAppData: AppData = {
  scores: null,
  contestants: [],
  season: { current_episode: 1 },
  captain: { picks: {} },
  isAdmin: false,
};

const AppDataContext = createContext<AppDataContextValue>({
  data: null,
  loading: true,
  error: null,
  refetch: async () => {},
});

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}

const noStore = { cache: "no-store" as RequestCache };

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch("/api/app-data", noStore);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Request failed: ${res.status}`);
      }
      const raw = await res.json();
      setData({
        scores: raw.scores ?? null,
        contestants: Array.isArray(raw.contestants) ? raw.contestants : [],
        season: raw.season ?? { current_episode: 1 },
        captain: raw.captain ?? { picks: {} },
        isAdmin: raw.isAdmin === true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  const value: AppDataContextValue = {
    data,
    loading,
    error,
    refetch,
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppDataOptional(): AppDataContextValue & { data: AppData } {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    return {
      data: defaultAppData,
      loading: false,
      error: null,
      refetch: async () => {},
    };
  }
  return {
    ...ctx,
    data: ctx.data ?? defaultAppData,
  };
}
