"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

interface League {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  member_count: number;
}

interface Standing {
  user_id: string;
  tribe_name: string;
  first_name: string;
  last_name: string;
  total_points: number;
}

const noStore = { cache: "no-store" as RequestCache };

function StandingsTable({ standings, currentUserId }: { standings: Standing[]; currentUserId: string }) {
  return (
    <div className="rounded-lg overflow-hidden stone-outline">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-700/50 text-stone-200/90">
            <th className="text-left px-4 py-3 font-semibold w-12">#</th>
            <th className="text-left px-4 py-3 font-semibold">Tribe</th>
            <th className="text-right px-4 py-3 font-semibold">Points</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr
              key={s.user_id}
              className={`border-t border-stone-600/50 ${s.user_id === currentUserId ? "bg-orange-900/20" : "bg-stone-800/30"}`}
            >
              <td className="px-4 py-3 text-stone-300">{i + 1}</td>
              <td className="px-4 py-3">
                <div className="text-stone-100 font-medium">{s.tribe_name}</div>
                <div className="text-stone-400 text-xs">{s.first_name} {s.last_name}</div>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-orange-400">
                {s.total_points} pts
              </td>
            </tr>
          ))}
          {standings.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-stone-400">
                No members with teams yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeagueCard({
  league,
  currentUserId,
}: {
  league: League;
  currentUserId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [standings, setStandings] = useState<Standing[] | null>(null);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStandings = useCallback(async () => {
    setLoadingStandings(true);
    try {
      const res = await fetch(`/api/leagues/${league.id}`, noStore);
      const data = await res.json();
      setStandings(data.standings ?? []);
    } catch {
      setStandings([]);
    } finally {
      setLoadingStandings(false);
    }
  }, [league.id]);

  const toggleExpand = () => {
    if (!expanded && !standings) loadStandings();
    setExpanded((e) => !e);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(league.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 rounded-xl texture-sandy bg-stone-800/90 stone-outline space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-stone-100">{league.name}</h3>
          <p className="text-xs text-stone-400">{league.member_count} member{league.member_count !== 1 ? "s" : ""}</p>
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="shrink-0 min-h-[44px] px-3 py-2 rounded-lg bg-stone-700/60 text-stone-300 text-xs font-mono hover:bg-stone-600/60 transition-colors touch-manipulation"
          title="Copy invite code"
        >
          {copied ? "Copied!" : league.invite_code}
        </button>
      </div>

      <button
        type="button"
        onClick={toggleExpand}
        className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
      >
        {expanded ? "Hide standings ▲" : "View standings ▼"}
      </button>

      {expanded && (
        <div className="mt-2">
          {loadingStandings ? (
            <p className="text-sm text-stone-400 py-4 text-center">Loading standings...</p>
          ) : (
            standings && <StandingsTable standings={standings} currentUserId={currentUserId} />
          )}
        </div>
      )}
    </div>
  );
}

export default function LeaguesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ code: string; name: string } | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [globalStandings, setGlobalStandings] = useState<Standing[] | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [showGlobal, setShowGlobal] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const fetchLeagues = useCallback(async () => {
    try {
      const res = await fetch("/api/leagues", noStore);
      const data = await res.json();
      setLeagues(data.leagues ?? []);
    } catch {
      setError("Failed to load leagues");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    setCreateResult(null);
    setError(null);

    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create league");
      setCreateResult({ code: data.league.invite_code, name: data.league.name });
      setCreateName("");
      setLeagues((prev) => [
        ...prev,
        {
          id: data.league.id,
          name: data.league.name,
          invite_code: data.league.invite_code,
          created_by: data.league.created_by,
          member_count: data.league.member_count ?? 1,
        },
      ]);
      await fetchLeagues();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create league");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinMsg(null);
    setError(null);

    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setJoinMsg({ type: "success", text: data.error ?? "You're already in this league." });
          setJoinCode("");
          fetchLeagues();
        } else {
          setJoinMsg({ type: "error", text: data.error ?? "Failed to join" });
        }
        return;
      }
      setJoinMsg({ type: "success", text: `Joined "${data.league_name}"!` });
      setJoinCode("");
      fetchLeagues();
    } catch {
      setJoinMsg({ type: "error", text: "Failed to join league" });
    } finally {
      setJoining(false);
    }
  };

  const loadGlobal = async () => {
    if (!showGlobal) {
      setShowGlobal(true);
      if (!globalStandings) {
        setGlobalLoading(true);
        try {
          const res = await fetch("/api/leaderboard", noStore);
          const data = await res.json();
          setGlobalStandings(data.standings ?? []);
        } catch {
          setGlobalStandings([]);
        } finally {
          setGlobalLoading(false);
        }
      }
    } else {
      setShowGlobal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-[3px] border-stone-600 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-stone-100">Leagues</h1>

      {error && (
        <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Your Leagues */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-200">Your Leagues</h2>
        {leagues.length === 0 ? (
          <p className="text-sm text-stone-400">You haven&apos;t joined any leagues yet. Create one or join with an invite code below.</p>
        ) : (
          <div className="space-y-3">
            {leagues.map((l) => (
              <LeagueCard key={l.id} league={l} currentUserId={user?.id ?? ""} />
            ))}
          </div>
        )}
      </section>

      {/* Create League */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-200">Create League</h2>
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="League name"
            required
            maxLength={50}
            className="flex-1 px-4 py-3 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={creating || !createName.trim()}
            className="px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold transition-colors min-h-[44px] shrink-0"
          >
            {creating ? "..." : "Create"}
          </button>
        </form>
        {createResult && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-700/40 text-emerald-300 text-sm">
            League &quot;{createResult.name}&quot; created! Invite code:{" "}
            <span className="font-mono font-bold text-emerald-200">{createResult.code}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(createResult.code)}
              className="ml-2 text-xs text-emerald-400 hover:text-emerald-300 underline"
            >
              Copy
            </button>
          </div>
        )}
      </section>

      {/* Join League */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-200">Join League</h2>
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="Enter 6-character code"
            required
            maxLength={6}
            className="flex-1 px-4 py-3 rounded-lg bg-stone-900/80 border border-stone-600/50 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/50 transition-colors font-mono tracking-widest text-center uppercase"
          />
          <button
            type="submit"
            disabled={joining || joinCode.length !== 6}
            className="px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold transition-colors min-h-[44px] shrink-0"
          >
            {joining ? "..." : "Join"}
          </button>
        </form>
        {joinMsg && (
          <div className={`p-3 rounded-lg text-sm ${joinMsg.type === "success" ? "bg-emerald-950/40 border border-emerald-700/40 text-emerald-300" : "bg-red-950/50 border border-red-800/50 text-red-300"}`}>
            {joinMsg.text}
          </div>
        )}
      </section>

      {/* Global Leaderboard */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={loadGlobal}
          className="text-lg font-semibold text-stone-200 hover:text-stone-100 transition-colors flex items-center gap-2"
        >
          Global Leaderboard {showGlobal ? "▲" : "▼"}
        </button>
        {showGlobal && (
          globalLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-stone-600 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : (
            globalStandings && <StandingsTable standings={globalStandings} currentUserId={user?.id ?? ""} />
          )
        )}
      </section>
    </div>
  );
}
