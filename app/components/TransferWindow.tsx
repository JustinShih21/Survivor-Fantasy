"use client";

import { useState, useEffect } from "react";
import { getDisplayPhotoUrl } from "@/lib/photo";
import { formatDisplayName } from "@/lib/formatName";
import { TribalRibbon } from "./TribalPattern";
import { getTribeDisplayName } from "@/lib/tribes";
import { VOTED_OUT_BADGE_CLASS, VOTED_OUT_BADGE_TEXT, VOTED_OUT_IMAGE_CLASS } from "@/lib/statusStyles";
import { CARD_CONTENT_MIN_H, CARD_MIN_WIDTH, CARD_WIDTH, PHOTO_HEIGHT } from "@/lib/cardDimensions";

const BUDGET_CAP = 1_000_000;
/** Point penalty per player added (transfer add); matches scoring_config.other.add_player_penalty */
const ADD_PLAYER_PENALTY = -10;

interface TransferWindowProps {
  currentEpisode: number;
  entries: { contestant_id: string; is_wild_card?: boolean; added_at_episode?: number }[];
  contestants: { id: string; name: string; starting_tribe: string; pre_merge_price: number; photo_url?: string }[];
  prices: { prices: Record<number, Record<string, { price: number; change?: number }>> } | null;
  episodeCount: number;
  onTransferred: () => void | Promise<void>;
  captainId: string | null;
  isPreseason?: boolean;
}

export function TransferWindow({
  currentEpisode,
  entries,
  contestants,
  prices,
  onTransferred,
  captainId,
  isPreseason = false,
}: TransferWindowProps) {
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [sellPicks, setSellPicks] = useState<Set<string>>(new Set());
  const [addPicks, setAddPicks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/eliminated?through=${currentEpisode}`)
      .then((r) => r.json())
      .then((d) => setEliminated(d.eliminated ?? []));
  }, [currentEpisode]);

  const rosterIds = new Set(entries.map((e) => e.contestant_id));
  const available = contestants.filter(
    (c) => !rosterIds.has(c.id) && !eliminated.includes(c.id)
  );
  const contestantMap = new Map(contestants.map((c) => [c.id, c]));

  const epPrices = prices?.prices?.[currentEpisode] ?? prices?.prices?.[1];

  const roster = entries.map((e) => {
    const c = contestantMap.get(e.contestant_id);
    const price = epPrices?.[e.contestant_id]?.price ?? c?.pre_merge_price ?? 0;
    return {
      ...e,
      name: c?.name ?? e.contestant_id,
      price,
      photo_url: getDisplayPhotoUrl(c?.photo_url, e.contestant_id),
      isVotedOut: eliminated.includes(e.contestant_id),
    };
  });

  const captainEntry = captainId ? roster.find((r) => r.contestant_id === captainId) ?? null : null;
  const rosterEntries = captainEntry ? roster.filter((r) => r.contestant_id !== captainId) : roster;

  // Tribe counts after selling all selected
  const tribeCountsAfterSell: Record<string, number> = { "Tribe A": 0, "Tribe B": 0, "Tribe C": 0 };
  for (const e of entries) {
    if (sellPicks.has(e.contestant_id)) continue;
    const c = contestantMap.get(e.contestant_id);
    if (c?.starting_tribe && tribeCountsAfterSell[c.starting_tribe] !== undefined) {
      tribeCountsAfterSell[c.starting_tribe]++;
    }
  }
  const tribesNeedingReplacement = (["Tribe A", "Tribe B", "Tribe C"] as const).filter(
    (t) => tribeCountsAfterSell[t] < 1
  );
  const addOptions =
    tribesNeedingReplacement.length > 0
      ? available.filter((c) =>
          tribesNeedingReplacement.includes(c.starting_tribe as "Tribe A" | "Tribe B" | "Tribe C")
        )
      : available;

  // Budget: $1M - roster cost + sell proceeds - add costs
  const rosterCost = roster.reduce((sum, r) => sum + r.price, 0);
  const sellProceeds = roster.filter((r) => sellPicks.has(r.contestant_id)).reduce((sum, r) => sum + r.price, 0);
  const addCost = addOptions
    .filter((c) => addPicks.has(c.id))
    .reduce((sum, c) => sum + (epPrices?.[c.id]?.price ?? c.pre_merge_price ?? 0), 0);
  const budgetRemaining = BUDGET_CAP - rosterCost + sellProceeds - addCost;

  // Projected point penalties: each add in the draft incurs add_player_penalty (derived, not persisted)
  const projectedPenalty = addPicks.size * ADD_PLAYER_PENALTY;

  const toggleSell = (id: string) => {
    setSellPicks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAdd = (id: string) => {
    setAddPicks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasMatchingSellsAdds = sellPicks.size > 0 && sellPicks.size === addPicks.size;
  const canConfirm = hasMatchingSellsAdds && budgetRemaining >= 0;

  const handleTransfer = async () => {
    if (!canConfirm) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sells: Array.from(sellPicks),
          adds: Array.from(addPicks).map((contestant_id) => ({ contestant_id })),
          current_episode: currentEpisode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transfer failed");
      setSellPicks(new Set());
      setAddPicks(new Set());
      await onTransferred();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="p-4 rounded-xl texture-sandy bg-stone-800/80 stone-outline">
        <h3 className="text-sm font-semibold text-stone-200/90 mb-1">Budget Remaining</h3>
        <p className={`text-2xl font-bold ${budgetRemaining >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          ${budgetRemaining.toLocaleString()}
        </p>
        <p className="text-xs text-stone-300/70 mt-1">
          {sellPicks.size > 0 && `+$${sellProceeds.toLocaleString()} from sells`}
          {sellPicks.size > 0 && addPicks.size > 0 && " · "}
          {addPicks.size > 0 && `-$${addCost.toLocaleString()} from adds`}
          {sellPicks.size === 0 && addPicks.size === 0 && "Select sells and adds to see budget change"}
        </p>
        {addPicks.size > 0 && (
          <p className="text-xs text-stone-300/70 mt-2 pt-2 border-t border-stone-600/50">
            Projected point penalties: {projectedPenalty} pts ({addPicks.size} add{addPicks.size !== 1 ? "s" : ""} × {ADD_PLAYER_PENALTY} pts)
          </p>
        )}
      </div>

      <div className="p-6 rounded-2xl space-y-6">
        <div className="flex flex-col items-center">
          <h3 className="sand-inscription mb-2 flex items-center gap-2 justify-center">
            <span className="text-orange-400/80">★</span> Captain
          </h3>
          {captainEntry && (() => {
            const r = captainEntry;
            const c = contestantMap.get(r.contestant_id);
            const baseCardClass = sellPicks.has(r.contestant_id)
              ? "border-red-500 bg-red-950/40 text-stone-100"
              : "stone-outline bg-stone-800/90 texture-sandy text-stone-200 hover:opacity-90";
            return (
              <button
                key={r.contestant_id}
                type="button"
                onClick={() => toggleSell(r.contestant_id)}
                className={`${CARD_WIDTH} ${CARD_MIN_WIDTH} flex flex-col rounded-xl overflow-hidden transition-colors touch-manipulation ${baseCardClass}`}
              >
                <div className={`${PHOTO_HEIGHT} w-full overflow-hidden bg-stone-800/50 relative shrink-0`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 to-transparent z-[1] pointer-events-none" />
                  <img src={r.photo_url} alt="" loading="lazy" decoding="async" className={`w-full h-full object-cover object-top ${r.isVotedOut ? VOTED_OUT_IMAGE_CLASS : ""}`} />
                </div>
                {c?.starting_tribe && <TribalRibbon tribeId={c.starting_tribe} />}
                <div className={`p-2 flex flex-col gap-0.5 items-center text-center shrink-0 ${CARD_CONTENT_MIN_H}`}>
                  <span className="font-bold text-sm">{formatDisplayName(r.name)}</span>
                  {r.isVotedOut && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${VOTED_OUT_BADGE_CLASS}`}>{VOTED_OUT_BADGE_TEXT}</span>
                  )}
                  <span className="text-xs text-stone-300/80">${r.price.toLocaleString()}</span>
                </div>
              </button>
            );
          })()}
        </div>

        <div className="flex flex-col items-center">
          <h3 className="sand-inscription mb-3 text-center w-full">Roster</h3>
          <div className="flex flex-wrap gap-3 justify-center">
          {rosterEntries.map((r) => {
            const c = contestantMap.get(r.contestant_id);
            const baseCardClass = sellPicks.has(r.contestant_id)
              ? "border-red-500 bg-red-950/40 text-stone-100"
              : "stone-outline bg-stone-800/90 texture-sandy text-stone-200 hover:opacity-90";
            return (
            <button
              key={r.contestant_id}
              type="button"
              onClick={() => toggleSell(r.contestant_id)}
              className={`${CARD_WIDTH} ${CARD_MIN_WIDTH} flex flex-col rounded-xl overflow-hidden transition-colors touch-manipulation ${baseCardClass}`}
            >
              <div className={`${PHOTO_HEIGHT} w-full overflow-hidden bg-stone-800/50 relative shrink-0`}>
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 to-transparent z-[1] pointer-events-none" />
                <img src={r.photo_url} alt="" loading="lazy" decoding="async" className={`w-full h-full object-cover object-top ${r.isVotedOut ? VOTED_OUT_IMAGE_CLASS : ""}`} />
              </div>
              {c?.starting_tribe && <TribalRibbon tribeId={c.starting_tribe} />}
              <div className={`p-2 flex flex-col gap-0.5 items-center text-center shrink-0 ${CARD_CONTENT_MIN_H}`}>
                <span className="font-bold text-sm">{formatDisplayName(r.name)}</span>
                {r.isVotedOut && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${VOTED_OUT_BADGE_CLASS}`}>{VOTED_OUT_BADGE_TEXT}</span>
                )}
                <span className="text-xs text-stone-300/80">${r.price.toLocaleString()}</span>
              </div>
            </button>
          );})}
          </div>
        </div>
      </div>

      {sellPicks.size > 0 || isPreseason ? (
        <div>
          <h4 className="text-sm font-medium mb-2 text-stone-100">
            {sellPicks.size > 0
              ? `Add ${tribesNeedingReplacement.length > 0 ? `(must replace ${tribesNeedingReplacement.map(getTribeDisplayName).join(", ")})` : "(any available)"}`
              : "Transferable players"}
          </h4>
          <p className="text-xs text-stone-300/70 mb-2">
            {sellPicks.size > 0
              ? `Select ${sellPicks.size} player${sellPicks.size !== 1 ? "s" : ""} to add`
              : "Select a player to sell from your roster above, then pick someone here to add."}
          </p>
          <div className="flex flex-wrap gap-3">
            {addOptions.map((c) => {
              const baseCardClass = addPicks.has(c.id)
                ? "border-red-500 bg-red-900/30 text-stone-100"
                : "stone-outline bg-stone-800/90 texture-sandy text-stone-200 hover:opacity-90";
              return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleAdd(c.id)}
                className={`${CARD_WIDTH} ${CARD_MIN_WIDTH} flex flex-col rounded-xl overflow-hidden transition-colors touch-manipulation ${baseCardClass}`}
              >
                <div className={`${PHOTO_HEIGHT} w-full overflow-hidden bg-stone-800/50 relative shrink-0`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 to-transparent z-[1] pointer-events-none" />
                  <img
                    src={getDisplayPhotoUrl(c.photo_url, c.id)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <TribalRibbon tribeId={c.starting_tribe} />
                <div className={`p-2 flex flex-col gap-0.5 items-center text-center shrink-0 ${CARD_CONTENT_MIN_H}`}>
                  <span className="font-bold text-sm">{formatDisplayName(c.name)}</span>
                  <span className="text-xs text-stone-300/80">
                    ${(epPrices?.[c.id]?.price ?? c.pre_merge_price ?? 0).toLocaleString()}
                  </span>
                </div>
              </button>
            );})}
          </div>
          {addOptions.length === 0 && (
            <p className="text-sm text-stone-300/70">No available contestants for this slot.</p>
          )}
        </div>
      ) : null}

      {hasMatchingSellsAdds && (
        <div className="flex flex-col gap-2">
          {isPreseason ? (
            <p className="text-sm text-amber-200/90">
              Pre-season: draft only — changes are not saved.
            </p>
          ) : (
            <>
              <p className="text-sm text-stone-300/80">
                Sell {sellPicks.size}, Add {addPicks.size} (-5 pts per add)
                {budgetRemaining < 0 && (
                  <span className="block text-red-400 mt-1">Over budget by ${Math.abs(budgetRemaining).toLocaleString()}</span>
                )}
              </p>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={loading || !canConfirm}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-stone-950 font-bold disabled:opacity-50 touch-manipulation transition-colors"
              >
                {loading ? "Processing..." : "Confirm Transfer"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
