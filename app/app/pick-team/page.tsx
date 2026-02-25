"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TeamRosterDisplay } from "@/components/TeamRosterDisplay";
import { useAppData } from "@/components/AppDataProvider";

export default function PickTeamPage() {
  const { data, loading, refetch } = useAppData();
  const scores = data?.scores ?? null;
  const contestants = data?.contestants ?? [];
  const currentEpisode = data?.season?.current_episode ?? 1;
  const captainId = (data?.captain?.picks?.[currentEpisode] ?? null) as string | null;
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [scoresForEpisode, setScoresForEpisode] = useState(data?.scores ?? null);

  useEffect(() => {
    if (data?.scores) {
      queueMicrotask(() => setScoresForEpisode(data.scores));
    }
  }, [data?.scores]);

  useEffect(() => {
    if (currentEpisode < 1) return;
    fetch(`/api/scores?through=${currentEpisode}`)
      .then((r) => r.json())
      .then(setScoresForEpisode)
      .catch(() => {});
  }, [currentEpisode]);

  useEffect(() => {
    if (currentEpisode < 1) return;
    fetch(`/api/eliminated?through=${currentEpisode}`)
      .then((r) => r.json())
      .then((d) => setEliminated(d.eliminated ?? []))
      .catch(() => setEliminated([]));
  }, [currentEpisode]);

  const refreshScores = () => {
    refetch().then(() => {
      fetch(`/api/scores?through=${currentEpisode}`)
        .then((r) => r.json())
        .then(setScoresForEpisode)
        .catch(() => {});
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-stone-300/80">Loading...</span>
      </div>
    );
  }

  if (!(scoresForEpisode ?? scores)?.entries?.length) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-stone-100">Pick Team</h1>
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-100">Pick Team</h1>

      <div className="p-6 rounded-2xl">
        <TeamRosterDisplay
          entries={(scoresForEpisode ?? scores)?.entries ?? []}
          contestants={contestants}
          currentEpisode={currentEpisode}
          captainId={captainId}
          onPicked={refreshScores}
          possessions={(scoresForEpisode ?? scores)?.possessions ?? {}}
          contestantTribes={{
            ...Object.fromEntries(contestants.map((c) => [c.id, c.starting_tribe])),
            ...((scoresForEpisode ?? scores)?.contestant_tribes ?? {}),
          }}
          eliminated={eliminated}
        />
      </div>
    </div>
  );
}
