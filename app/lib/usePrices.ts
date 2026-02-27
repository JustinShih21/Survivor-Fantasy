"use client";

import useSWR from "swr";

const noStore = { cache: "no-store" as RequestCache };

/** Shape returned by GET /api/prices?through=N */
export interface PricesResponse {
  through?: number;
  prices: Record<number, Record<string, { price: number; change?: number }>>;
  base_prices?: Record<string, number>;
}

const SWR_OPTIONS = {
  revalidateOnFocus: true,
  revalidateIfStale: true,
  refreshInterval: 30000,
};

async function fetcher(url: string): Promise<PricesResponse> {
  const res = await fetch(url, noStore);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface UsePricesResult {
  prices: PricesResponse | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Fetches /api/prices?through=N. Keyed only by throughEpisode so effects
 * can depend on episode number without touching composite data.
 */
export function usePrices(throughEpisode: number): UsePricesResult {
  const effective = Math.max(1, throughEpisode);
  const key = effective < 1 ? null : [`/api/prices`, effective] as const;
  const { data, isLoading, mutate } = useSWR<PricesResponse | undefined>(
    key ? `${key[0]}?through=${key[1]}` : null,
    fetcher,
    SWR_OPTIONS
  );

  return {
    prices: data ?? null,
    loading: isLoading,
    refetch: async () => {
      await mutate();
    },
  };
}
