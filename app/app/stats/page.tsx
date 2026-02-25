"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import type { ContestantStats } from "@/app/api/stats/route";
import { getTribeDisplayName } from "@/lib/tribes";

type SortKey = keyof Pick<
  ContestantStats,
  | "total_points"
  | "price"
  | "latest_week_points"
  | "challenges_won"
  | "bonus_points"
  | "confessional_points"
  | "tribal_points"
  | "advantage_points"
  | "survival_points"
  | "votes_received"
  | "physicality"
  | "cognition"
  | "strategy"
  | "influence"
  | "resilience"
>;

const COLUMNS: { key: SortKey; label: string; format?: (v: number) => string }[] = [
  { key: "total_points", label: "Total Pts" },
  { key: "latest_week_points", label: "Latest Wk" },
  { key: "price", label: "Price", format: (v) => `$${(v / 1000).toFixed(0)}k` },
  { key: "challenges_won", label: "Challenges" },
  { key: "bonus_points", label: "Bonus Pts" },
  { key: "survival_points", label: "Survival" },
  { key: "tribal_points", label: "Tribal" },
  { key: "confessional_points", label: "Confess." },
  { key: "advantage_points", label: "Advantages" },
  { key: "votes_received", label: "Votes Recv" },
  { key: "physicality", label: "Physicality" },
  { key: "cognition", label: "Cognition" },
  { key: "strategy", label: "Strategy" },
  { key: "influence", label: "Influence" },
  { key: "resilience", label: "Resilience" },
];

function formatName(name: string): string {
  const parts = name.split(" ");
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts.slice(1).map((p) => `${p[0]}.`).join(" ")}`;
}

const SKELETON_ROW_COUNT = 18;

function StatsTableSkeleton() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-100 tracking-wide">
        Contestant Stats
      </h1>
      <p className="text-sm text-stone-400">
        Click any column header to sort. Click again to reverse.
      </p>
      <div className="overflow-x-auto rounded-lg stone-outline">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-stone-800/80 text-stone-300 border-b border-stone-700/50">
              <th className="px-3 py-2.5 text-left font-medium sticky left-0 bg-stone-800/95 z-10 w-8">
                #
              </th>
              <th className="px-3 py-2.5 text-left font-medium sticky left-8 bg-stone-800/95 z-10 min-w-[140px]">
                Player
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 text-right font-medium"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
              <tr
                key={i}
                className={`border-b border-stone-700/30 ${
                  i % 2 === 0 ? "bg-stone-800/40" : "bg-stone-800/20"
                }`}
              >
                <td className="px-3 py-2 sticky left-0 bg-inherit z-10 text-center text-xs w-8 text-stone-500">
                  {i + 1}
                </td>
                <td className="px-3 py-2 sticky left-8 bg-inherit z-10">
                  <div className="space-y-1">
                    <div className="h-3.5 w-20 bg-stone-700 rounded animate-pulse" />
                    <div className="h-2.5 w-14 bg-stone-700/80 rounded animate-pulse" />
                  </div>
                </td>
                {COLUMNS.map((col) => (
                  <td key={col.key} className="px-3 py-2 text-right">
                    <div className="h-4 w-10 bg-stone-700/80 rounded animate-pulse inline-block" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function fetchStats(): Promise<ContestantStats[]> {
  const res = await fetch("/api/stats", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load stats");
  const data = await res.json();
  const list = data.stats ?? [];
  if (list.length > 0) return list;
  const contestantsRes = await fetch("/api/contestants", { cache: "no-store" });
  if (!contestantsRes.ok) return [];
  const contestants = await contestantsRes.json();
  if (!Array.isArray(contestants) || contestants.length === 0) return [];
  return contestants.map((c: { id: string; name: string; starting_tribe: string; photo_url?: string; pre_merge_price?: number; physicality?: number; cognition?: number; strategy?: number; influence?: number; resilience?: number }) => ({
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

export default function StatsPage() {
  const { data: stats = [], isLoading, error } = useSWR<ContestantStats[]>(
    "/api/stats",
    fetchStats,
    { revalidateOnFocus: true, revalidateIfStale: true, refreshInterval: 30000 }
  );
  const [sortKey, setSortKey] = useState<SortKey>("total_points");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...stats];
    copy.sort((a, b) => {
      const av = a[sortKey] as number | undefined;
      const bv = b[sortKey] as number | undefined;
      const aNum = av ?? 0;
      const bNum = bv ?? 0;
      return sortAsc ? aNum - bNum : bNum - aNum;
    });
    return copy;
  }, [stats, sortKey, sortAsc]);

  const leaders = useMemo(() => {
    if (stats.length === 0) {
      return { points: null, challenges: null, influence: null };
    }
    const byPoints = [...stats].sort((a, b) => b.total_points - a.total_points)[0];
    const byChallenges = [...stats].sort((a, b) => b.challenges_won - a.challenges_won)[0];
    const byBonus = [...stats].sort((a, b) => b.bonus_points - a.bonus_points)[0];
    return {
      points: byPoints?.total_points != null && byPoints.total_points > 0 ? byPoints : null,
      challenges: byChallenges?.challenges_won != null && byChallenges.challenges_won > 0 ? byChallenges : null,
      influence: byBonus?.bonus_points != null && byBonus.bonus_points > 0 ? byBonus : null,
    };
  }, [stats]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  if (isLoading && stats.length === 0) {
    return <StatsTableSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-stone-400">Failed to load stats. Try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-100 tracking-wide">
        Contestant Stats
      </h1>
      <p className="text-sm text-stone-400">
        Click any column header to sort. Click again to reverse.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="p-4 rounded-xl texture-sandy bg-stone-800/90 stone-outline">
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">
            Most Points
          </h3>
          <div className="font-medium text-stone-100">
            {leaders.points ? formatName(leaders.points.name) : "—"}
          </div>
          <div className="text-lg font-bold text-orange-400 tabular-nums mt-0.5">
            {leaders.points != null ? leaders.points.total_points : "—"}
          </div>
        </div>
        <div className="p-4 rounded-xl texture-sandy bg-stone-800/90 stone-outline">
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">
            Most Challenge Wins
          </h3>
          <div className="font-medium text-stone-100">
            {leaders.challenges ? formatName(leaders.challenges.name) : "—"}
          </div>
          <div className="text-lg font-bold text-orange-400 tabular-nums mt-0.5">
            {leaders.challenges != null ? leaders.challenges.challenges_won : "—"}
          </div>
        </div>
        <div className="p-4 rounded-xl texture-sandy bg-stone-800/90 stone-outline">
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">
            Most Influence Points
          </h3>
          <div className="font-medium text-stone-100">
            {leaders.influence ? formatName(leaders.influence.name) : "—"}
          </div>
          <div className="text-lg font-bold text-orange-400 tabular-nums mt-0.5">
            {leaders.influence != null ? leaders.influence.bonus_points : "—"}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg stone-outline">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-stone-800/80 text-stone-300 border-b border-stone-700/50">
              <th className="px-3 py-2.5 text-left font-medium sticky left-0 bg-stone-800/95 z-10 w-8">
                #
              </th>
              <th className="px-3 py-2.5 text-left font-medium sticky left-8 bg-stone-800/95 z-10 min-w-[140px]">
                Player
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2.5 text-right font-medium cursor-pointer select-none hover:text-orange-400 transition-colors"
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-orange-400 text-xs">
                        {sortAsc ? "\u25B2" : "\u25BC"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const isOut = c.status !== "active";
              return (
                <tr
                  key={c.id}
                  className={`border-b border-stone-700/30 transition-colors ${
                    isOut
                      ? "opacity-50 bg-stone-900/40"
                      : i % 2 === 0
                      ? "bg-stone-800/40"
                      : "bg-stone-800/20"
                  } hover:bg-stone-700/40`}
                >
                  <td className="px-3 py-2 text-stone-500 sticky left-0 bg-inherit z-10 text-center text-xs w-8">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2 sticky left-8 bg-inherit z-10">
                    <div className="leading-tight">
                      <div className={`font-medium ${isOut ? "line-through text-stone-500" : "text-stone-100"}`}>
                        {formatName(c.name)}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {getTribeDisplayName(c.tribe ?? c.starting_tribe)}
                        {isOut && (
                          <span className="ml-1 text-red-400/80 font-semibold uppercase">
                            {c.status === "quit" ? "Quit" : "Out"}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {COLUMNS.map((col) => {
                    const val = c[col.key] as number | undefined;
                    const formatted =
                      val != null
                        ? col.format
                          ? col.format(val)
                          : val.toString()
                        : "—";
                    const isNegative = typeof val === "number" && val < 0;
                    const isHighlight = col.key === sortKey;
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2 text-right tabular-nums ${
                          isHighlight
                            ? "text-orange-300 font-semibold"
                            : isNegative
                            ? "text-red-400"
                            : "text-stone-200"
                        }`}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
