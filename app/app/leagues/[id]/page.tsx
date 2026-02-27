"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StandingsTable, type Standing } from "@/components/StandingsTable";

const noStore = { cache: "no-store" as RequestCache };

type LeagueInfo = { id: string; name: string; invite_code: string };
type LeagueApiSuccess = { league: LeagueInfo; standings: Standing[]; current_user_id: string };

export default function LeaguePage() {
  const params = useParams();
  const id = params.id as string;
  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"forbidden" | "not_found" | "error" | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/leagues/${id}`, noStore)
      .then((res) => {
        if (cancelled) return res.json() as Promise<LeagueApiSuccess | { error: string }>;
        if (res.status === 404) {
          setError("not_found");
          return Promise.resolve(null);
        }
        if (res.status === 403) {
          setError("forbidden");
          return Promise.resolve(null);
        }
        if (!res.ok) {
          setError("error");
          return Promise.resolve(null);
        }
        return res.json() as Promise<LeagueApiSuccess>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data && "league" in data && data.league) {
          setLeague(data.league);
          setStandings(data.standings ?? []);
          setCurrentUserId(data.current_user_id ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setError("error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const copyCode = () => {
    if (!league) return;
    navigator.clipboard.writeText(league.invite_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-[3px] border-stone-600 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="space-y-4">
        <p className="text-stone-300">League not found.</p>
        <Link href="/leagues" className="text-orange-400 hover:text-orange-300">
          Back to Leagues
        </Link>
      </div>
    );
  }

  if (error === "forbidden") {
    return (
      <div className="space-y-4">
        <p className="text-stone-300">You are not a member of this league.</p>
        <Link href="/leagues" className="text-orange-400 hover:text-orange-300">
          Back to Leagues
        </Link>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="space-y-4">
        <p className="text-stone-300">Something went wrong loading this league.</p>
        <Link href="/leagues" className="text-orange-400 hover:text-orange-300">
          Back to Leagues
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leagues" className="text-sm text-orange-400 hover:text-orange-300 mb-2 inline-block">
          ← Back to Leagues
        </Link>
        <h1 className="text-2xl font-bold text-stone-100">{league.name}</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-stone-400">Invite code:</span>
          <button
            type="button"
            onClick={copyCode}
            className="font-mono text-sm text-stone-300 hover:text-stone-100 bg-stone-700/60 px-2 py-1 rounded"
          >
            {league.invite_code}
          </button>
          {codeCopied && <span className="text-xs text-stone-500">Copied!</span>}
        </div>
      </div>
      <div className="w-full">
        <StandingsTable standings={standings} currentUserId={currentUserId} />
      </div>
    </div>
  );
}
