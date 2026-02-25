"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TransferWindow } from "@/components/TransferWindow";
import { useAppData } from "@/components/AppDataProvider";

const noStore = { cache: "no-store" as RequestCache };

interface PriceData {
  prices: Record<number, Record<string, { price: number; change?: number }>>;
}

export default function TransfersPage() {
  const router = useRouter();
  const { data, loading: appDataLoading, refetch } = useAppData();
  const scores = data?.scores ?? null;
  const contestants = data?.contestants ?? [];
  const currentEpisode = data?.season?.current_episode ?? 1;
  const captainId = (data?.captain?.picks?.[currentEpisode] ?? null) as string | null;
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [pricesLoading, setPricesLoading] = useState(true);

  useEffect(() => {
    if (currentEpisode < 1) {
      queueMicrotask(() => setPricesLoading(false));
      return;
    }
    queueMicrotask(() => setPricesLoading(true));
    fetch(`/api/prices?through=${Math.max(1, currentEpisode)}`, noStore)
      .then((r) => r.json())
      .then(setPrices)
      .catch(() => setPrices(null))
      .finally(() => setPricesLoading(false));
  }, [currentEpisode]);

  const loading = appDataLoading || pricesLoading;

  const refreshAll = async () => {
    await refetch();
    const priceRes = await fetch(`/api/prices?through=${currentEpisode}`, noStore).then((r) => r.json());
    setPrices(priceRes);
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-stone-300/80">Loading...</span>
      </div>
    );
  }

  if (!scores?.entries?.length) {
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
        entries={scores.entries}
        contestants={contestants}
        prices={prices}
        episodeCount={scores.episode_count ?? 6}
        onTransferred={refreshAll}
        captainId={captainId}
        isPreseason={isPreseason}
      />
    </div>
  );
}
