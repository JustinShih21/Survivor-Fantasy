"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAppData } from "@/components/AppDataProvider";
import { PlayerDetailContent } from "@/components/PlayerDetailModal";
import { getHighResPhotoUrl } from "@/lib/photo";
import type { ContestantPointsSummary } from "@/lib/scoring";

export default function PlayerPointsPage() {
  const params = useParams();
  const contestantId = typeof params?.contestantId === "string" ? params.contestantId : "";
  const { data, loading } = useAppData();
  const scores = data?.scores ?? null;
  const contestants = data?.contestants ?? [];
  const currentEpisode = data?.season?.current_episode ?? 1;
  const breakdownMap = new Map<string, ContestantPointsSummary>(
    ((scores?.contestant_breakdowns ?? []) as ContestantPointsSummary[]).map((b) => [b.contestant_id, b])
  );
  const contestantMap = new Map(contestants.map((c) => [c.id, c]));
  const allEntries = (scores?.all_entries ?? scores?.entries ?? []).length > 0
    ? (scores?.all_entries ?? scores?.entries ?? [])
    : scores?.entries ?? [];
  const [eliminated, setEliminated] = useState<string[]>([]);

  useEffect(() => {
    const through = Math.max(1, currentEpisode);
    fetch(`/api/eliminated?through=${through}`)
      .then((r) => r.json())
      .then((d) => setEliminated(d.eliminated ?? []))
      .catch(() => setEliminated([]));
  }, [currentEpisode]);

  const contestant = contestantId ? contestantMap.get(contestantId) : null;
  const breakdown = contestantId ? breakdownMap.get(contestantId) : null;
  const entry = contestantId ? allEntries.find((e) => e.contestant_id === contestantId) : null;
  const isOnRoster = !!entry;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-stone-300/80">Loading...</span>
      </div>
    );
  }

  if (!contestantId || !contestant || !breakdown || !isOnRoster) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-stone-100">Points</h1>
        <div className="p-8 rounded-2xl texture-sandy bg-stone-800/90 stone-outline text-center">
          <p className="text-stone-300/90 mb-6">Player not found.</p>
          <Link
            href="/points"
            className="inline-block px-6 py-3 rounded-xl bg-stone-600 hover:bg-stone-500 text-stone-100 font-medium transition-colors"
          >
            ← Back to Points
          </Link>
        </div>
      </div>
    );
  }

  const photoUrl = getHighResPhotoUrl(contestant.photo_url, contestantId);
  const traits =
    contestant != null
      ? {
          physicality: contestant.physicality ?? 50,
          cognition: contestant.cognition ?? 50,
          strategy: contestant.strategy ?? 50,
          influence: contestant.influence ?? 50,
          resilience: contestant.resilience ?? 50,
        }
      : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/points"
          className="text-stone-300 hover:text-stone-100 transition-colors"
        >
          ← Back to Points
        </Link>
      </div>

      <div className="w-full max-w-md mx-auto rounded-2xl shadow-2xl stone-outline texture-sandy bg-stone-900 overflow-hidden">
        <div className="relative">
          <PlayerDetailContent
            name={contestant.name}
            photoUrl={photoUrl}
            tribe={contestant.starting_tribe}
            isWildCard={entry?.is_wild_card}
            addedAtEpisode={entry?.added_at_episode ?? 1}
            breakdown={breakdown}
            isVotedOut={eliminated.includes(contestantId)}
            isTransferredOut={entry && "removed_at_episode" in entry ? entry.removed_at_episode != null : false}
            traits={traits}
          />
        </div>
      </div>
    </div>
  );
}
