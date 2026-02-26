"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TransferWindow } from "@/components/TransferWindow";
import { usePlayerCardData } from "@/lib/usePlayerCardData";
import { usePrices } from "@/lib/usePrices";

export default function TransfersPage() {
  const router = useRouter();
  const { data, loading: appDataLoading, refetch, currentEpisode: hookEpisode } = usePlayerCardData();
  const effectiveEpisode = Math.max(1, hookEpisode);
  const { prices, loading: pricesLoading, refetch: refetchPrices } = usePrices(effectiveEpisode);

  const scores = data?.scores ?? null;
  const contestants = data?.contestants ?? [];
  const currentEpisode = hookEpisode;
  const captainId = (data?.captain?.picks?.[effectiveEpisode] ?? null) as string | null;
  const [refetchedOnce, setRefetchedOnce] = useState(false);
  const [refetchingEmpty, setRefetchingEmpty] = useState(false);

  const entriesLength = scores?.entries?.length ?? 0;
  const showEmptyState = entriesLength === 0;

  useEffect(() => {
    if (!showEmptyState || refetchedOnce || appDataLoading) return;
    setRefetchedOnce(true);
    setRefetchingEmpty(true);
    refetch().finally(() => setRefetchingEmpty(false));
  }, [showEmptyState, refetchedOnce, appDataLoading, refetch]);

  const loading = appDataLoading || pricesLoading || refetchingEmpty;

  const refreshAll = async () => {
    await refetch();
    await refetchPrices();
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-stone-300/80">Loading...</span>
      </div>
    );
  }

  if (showEmptyState) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-stone-100">Transfers</h1>
        <div className="p-8 rounded-2xl texture-sandy bg-stone-800/90 stone-outline text-center">
          <p className="text-stone-300/90 mb-6">
            You haven&apos;t built your tribe yet.
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-stone-950 font-bold transition-colors shadow-lg"
          >
            Build Your Tribe
          </Link>
        </div>
      </div>
    );
  }

  const isPreseason = currentEpisode === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-100">Transfers</h1>
      <p className="text-stone-300/80 text-sm">
        {isPreseason
          ? "Pre-season: try hypothetical swaps. Changes are not saved."
          : `After Episode ${currentEpisode}. Sell and add contestants before advancing to the next episode.`}
      </p>

      <TransferWindow
        currentEpisode={currentEpisode}
        entries={scores?.entries ?? []}
        contestants={contestants}
        prices={prices}
        episodeCount={scores?.episode_count ?? 6}
        onTransferred={refreshAll}
        captainId={captainId}
        isPreseason={isPreseason}
      />
    </div>
  );
}
