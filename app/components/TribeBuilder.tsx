"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BudgetBar } from "./BudgetBar";
import { ContestantCard } from "./ContestantCard";
import { getTribeDisplayName } from "@/lib/tribes";
import { useAppData } from "@/components/AppDataProvider";

const BUDGET = 1_000_000;
const ROSTER_SIZE = 7;
const MIN_PER_TRIBE = 1;

interface Contestant {
  id: string;
  name: string;
  starting_tribe: string;
  pre_merge_price: number;
  photo_url?: string;
}

interface Selection {
  contestant_id: string;
  is_wild_card: boolean;
}

function groupByTribe(contestants: Contestant[]) {
  const groups: Record<string, Contestant[]> = { "Tribe A": [], "Tribe B": [], "Tribe C": [] };
  for (const c of contestants) {
    if (groups[c.starting_tribe]) groups[c.starting_tribe].push(c);
  }
  return groups;
}

export function TribeBuilder() {
  const router = useRouter();
  const { refetch } = useAppData();
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [selection, setSelection] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/contestants")
      .then((r) => r.json())
      .then((data) => setContestants(Array.isArray(data) ? data : []))
      .catch(() => setContestants([]))
      .finally(() => setLoading(false));
  }, []);

  const tribeCounts: Record<string, number> = { "Tribe A": 0, "Tribe B": 0, "Tribe C": 0 };
  for (const s of selection) {
    const c = contestants.find((x) => x.id === s.contestant_id);
    if (c && tribeCounts[c.starting_tribe] !== undefined) tribeCounts[c.starting_tribe]++;
  }

  const totalCost = selection.reduce((sum, s) => {
    const c = contestants.find((x) => x.id === s.contestant_id);
    return sum + Number(c?.pre_merge_price ?? 0);
  }, 0);

  const canAdd = (c: Contestant): boolean => {
    if (selection.some((s) => s.contestant_id === c.id)) return false;
    if (selection.length >= ROSTER_SIZE) return false;
    // If adding would leave a tribe with 0, we can't add from a different tribe
    const count = tribeCounts[c.starting_tribe] ?? 0;
    return true;
  };

  const toggle = (c: Contestant) => {
    const idx = selection.findIndex((s) => s.contestant_id === c.id);
    if (idx >= 0) {
      setSelection(selection.filter((_, i) => i !== idx));
    } else if (canAdd(c)) {
      setSelection([...selection, { contestant_id: c.id, is_wild_card: false }]);
    }
  };

  const isSelected = (id: string) => selection.some((s) => s.contestant_id === id);

  const meetsTribeConstraint = (): boolean => {
    for (const count of Object.values(tribeCounts)) {
      if (count < MIN_PER_TRIBE) return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (selection.length !== ROSTER_SIZE) {
      setError("Must select exactly 7 contestants");
      return;
    }
    if (totalCost > BUDGET) {
      setError("Over budget");
      return;
    }
    if (!meetsTribeConstraint()) {
      setError("Must have at least 1 contestant from each tribe");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/tribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: selection }),
      });
      let data: { error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error(res.ok ? "Invalid response" : `Request failed (${res.status})`);
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      await refetch();
      router.refresh();
      router.push("/pick-team");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit";
      setError(msg);
      console.error("Tribe submit failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-stone-300/80">Loading contestants...</span>
      </div>
    );
  }

  const groups = groupByTribe(contestants);
  const valid =
    selection.length === ROSTER_SIZE &&
    totalCost <= BUDGET &&
    meetsTribeConstraint();

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-stone-100">Build Your Tribe</h1>
        <p className="text-stone-300/80 text-sm mt-1">
          Outwit · Outplay · Outlast
        </p>
      </div>
      <p className="text-stone-300/90 text-sm">
        Select 7 contestants with at least 1 from each tribe. Budget: $1,000,000
      </p>

      <BudgetBar total={totalCost} />

      <div className="flex gap-2 text-sm flex-wrap text-stone-300/90">
        <span>{getTribeDisplayName("Tribe A")}: {tribeCounts["Tribe A"]} (min 1)</span>
        <span>{getTribeDisplayName("Tribe B")}: {tribeCounts["Tribe B"]} (min 1)</span>
        <span>{getTribeDisplayName("Tribe C")}: {tribeCounts["Tribe C"]} (min 1)</span>
        <span>Total: {selection.length}/7</span>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {(["Tribe A", "Tribe B", "Tribe C"] as const).map((tribe) => (
          <div key={tribe}>
            <h2 className="text-lg font-semibold mb-3 text-stone-100">{getTribeDisplayName(tribe)}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {groups[tribe]?.map((c) => (
                <ContestantCard
                  key={c.id}
                  contestant={c}
                  selected={isSelected(c.id)}
                  onToggle={() => toggle(c)}
                  disabled={!isSelected(c.id) && selection.length >= ROSTER_SIZE}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!valid || submitting}
        className="w-full min-h-[44px] py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-stone-950 font-bold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation transition-colors"
        title={!valid ? (selection.length < ROSTER_SIZE ? "Select 7 contestants" : !meetsTribeConstraint() ? "Need at least 1 from each tribe" : totalCost > BUDGET ? "Over budget" : "") : undefined}
      >
        {submitting ? "Creating..." : !valid && selection.length < ROSTER_SIZE ? `Select ${ROSTER_SIZE - selection.length} more` : "Create Tribe"}
      </button>
    </div>
  );
}
