"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RosterCard } from "@/components/RosterCard";
import { getDisplayPhotoUrl } from "@/lib/photo";
import type { ContestantPointsSummary } from "@/lib/scoring";
import { usePlayerCardData } from "@/lib/usePlayerCardData";

export default function PointsPage() {
  const { data, loading, refetch } = usePlayerCardData();
  const scores = data?.scores ?? null;
  const contestants = data?.contestants ?? [];
  const currentEpisode = data?.season?.current_episode ?? 1;
  const captainPicks = data?.captain?.picks ?? {};
  const [viewingEpisode, setViewingEpisode] = useState(currentEpisode);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [refetchedOnce, setRefetchedOnce] = useState(false);
  const [refetchingEmpty, setRefetchingEmpty] = useState(false);

  const entriesLength = scores?.entries?.length ?? 0;
  const showEmptyState = entriesLength === 0;

  useEffect(() => {
    if (!showEmptyState || refetchedOnce || loading) return;
    queueMicrotask(() => {
      setRefetchedOnce(true);
      setRefetchingEmpty(true);
    });
    refetch().finally(() => setRefetchingEmpty(false));
  }, [showEmptyState, refetchedOnce, loading, refetch]);

  useEffect(() => {
    queueMicrotask(() => {
      setViewingEpisode((prev) =>
        currentEpisode >= 1 ? Math.min(prev, currentEpisode) : prev
      );
    });
  }, [currentEpisode]);

  const episodeCount = scores?.episode_count ?? 6;
  const maxViewableEpisode = currentEpisode;
  const epTotal = ((scores?.contestant_breakdowns ?? []) as ContestantPointsSummary[]).reduce(
    (sum, b) => {
      const ep = b.episodes.find((e) => e.episode_id === viewingEpisode);
      return sum + (ep?.total ?? 0);
    },
    0
  );

  useEffect(() => {
    if (viewingEpisode < 1) return;
    fetch(`/api/eliminated?through=${viewingEpisode}`)
      .then((r) => r.json())
      .then((d) => setEliminated(d.eliminated ?? []))
      .catch(() => setEliminated([]));
  }, [viewingEpisode]);

  if (loading || refetchingEmpty) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-stone-300/80">Loading...</span>
      </div>
    );
  }

  const contestantMap = new Map(contestants.map((c) => [c.id, c]));
  const breakdownMap = new Map(
    ((scores?.contestant_breakdowns ?? []) as ContestantPointsSummary[]).map((b) => [b.contestant_id, b])
  );

  const allEntries = (scores?.all_entries ?? scores?.entries ?? []).length > 0
    ? (scores?.all_entries ?? scores?.entries ?? [])
    : scores?.entries ?? [];
  const displayEntries = allEntries.filter((e) => {
    if (e.added_at_episode > viewingEpisode) return false;
    const removed = "removed_at_episode" in e ? e.removed_at_episode : null;
    if (typeof removed === "number" && removed < viewingEpisode) return false;
    return true;
  });

  if (showEmptyState) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-stone-100">Points</h1>
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

  const captainId = captainPicks[viewingEpisode] ?? null;
  const captainEntry = captainId
    ? displayEntries.find((e) => e.contestant_id === captainId) ?? null
    : null;
  const rosterEntries = captainEntry
    ? displayEntries.filter((e) => e.contestant_id !== captainId)
    : displayEntries;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-100">Points</h1>

      <div className="flex items-center justify-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => setViewingEpisode((e) => Math.max(1, e - 1))}
          disabled={viewingEpisode <= 1}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg bg-stone-700/80 text-stone-200 hover:bg-stone-600/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation"
          aria-label="Previous week"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-400">
            Ep {viewingEpisode}: {epTotal} pts
          </div>
          <div className="text-sm text-stone-300/80 mt-0.5">
            Total: {scores?.total ?? 0} pts
          </div>
        </div>
        <button
          type="button"
          onClick={() => setViewingEpisode((e) => Math.min(maxViewableEpisode, e + 1))}
          disabled={viewingEpisode >= maxViewableEpisode}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg bg-stone-700/80 text-stone-200 hover:bg-stone-600/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation"
          aria-label="Next week"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="p-6 rounded-2xl space-y-6">
        <div className="space-y-6">
        <div className="flex flex-col items-center">
          <h3 className="sand-inscription mb-2 flex items-center gap-2 justify-center">
            <span className="text-orange-400/80">★</span> Captain
          </h3>
          {captainEntry && (() => {
            const c = contestantMap.get(captainEntry.contestant_id);
            const b = breakdownMap.get(captainEntry.contestant_id);
            const photoUrl = getDisplayPhotoUrl(c?.photo_url, captainEntry.contestant_id);
            const epData = b?.episodes.find((ep) => ep.episode_id === viewingEpisode);
            const weekPoints = epData?.total ?? 0;
            const removedAt = "removed_at_episode" in captainEntry ? captainEntry.removed_at_episode : null;
            if (!b) return null;
            const traits =
              c != null
                ? {
                    physicality: c.physicality ?? 50,
                    cognition: c.cognition ?? 50,
                    strategy: c.strategy ?? 50,
                    influence: c.influence ?? 50,
                    resilience: c.resilience ?? 50,
                  }
                : undefined;
            return (
              <RosterCard
                key={captainEntry.contestant_id}
                contestantId={captainEntry.contestant_id}
                name={c?.name ?? captainEntry.contestant_id}
                photoUrl={photoUrl}
                rawPhotoUrl={c?.photo_url}
                addedAtEpisode={captainEntry.added_at_episode}
                isWildCard={captainEntry.is_wild_card}
                breakdown={b}
                weekPoints={weekPoints}
                isVotedOut={eliminated.includes(captainEntry.contestant_id)}
                isTransferredOut={removedAt != null}
                tribe={c?.starting_tribe}
                isCaptain
                traits={traits}
              />
            );
          })()}
        </div>

        <div className="flex flex-col items-center">
          <h3 className="sand-inscription mb-3 text-center w-full">Roster</h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {rosterEntries.map((e) => {
              const c = contestantMap.get(e.contestant_id);
              const b = breakdownMap.get(e.contestant_id);
              const photoUrl = getDisplayPhotoUrl(c?.photo_url, e.contestant_id);
              const epData = b?.episodes.find((ep) => ep.episode_id === viewingEpisode);
              const weekPoints = epData?.total ?? 0;
              const removedAt = "removed_at_episode" in e ? e.removed_at_episode : null;

              if (!b) return null;

              const traits =
                c != null
                  ? {
                      physicality: c.physicality ?? 50,
                      cognition: c.cognition ?? 50,
                      strategy: c.strategy ?? 50,
                      influence: c.influence ?? 50,
                      resilience: c.resilience ?? 50,
                    }
                  : undefined;
              const epDataForCaptain = b?.episodes.find((ep) => ep.episode_id === viewingEpisode);
              return (
                <RosterCard
                  key={e.contestant_id}
                  contestantId={e.contestant_id}
                  name={c?.name ?? e.contestant_id}
                  photoUrl={photoUrl}
                  rawPhotoUrl={c?.photo_url}
                  addedAtEpisode={e.added_at_episode}
                  isWildCard={e.is_wild_card}
                  breakdown={b}
                  weekPoints={weekPoints}
                  isVotedOut={eliminated.includes(e.contestant_id)}
                  isTransferredOut={removedAt != null}
                  tribe={c?.starting_tribe}
                  isCaptain={epDataForCaptain?.is_captain ?? false}
                  traits={traits}
                />
              );
            })}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
