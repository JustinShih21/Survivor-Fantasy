/**
 * Materialize contestant prices per episode into contestant_episode_prices.
 * Runs the same formula as lib/prices / api/prices and UPSERTs for episodes 1..through.
 * Use admin client for writes (bypasses RLS).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateContestantEpisodeBreakdown } from "@/lib/scoring";
import type { EpisodeOutcome, ScoringConfig } from "@/lib/scoring";
import contestantsSeed from "@/seed/contestants.json";
import episodeOutcomesSeed from "@/seed/episode_outcomes.json";
import scoringConfigSeed from "@/seed/scoring_config.json";

export async function materializePricesForEpisodes(
  through: number,
  admin: SupabaseClient
): Promise<{ episodeCount: number; rowCount: number }> {
  const [contestantsRes, outcomesRes, configRes] = await Promise.all([
    admin.from("contestants").select("id, pre_merge_price").order("id"),
    admin
      .from("episode_outcomes")
      .select("episode_id, outcome")
      .order("episode_id")
      .lte("episode_id", through),
    admin.from("scoring_config").select("config").eq("id", "default").single(),
  ]);

  const useSeed =
    contestantsRes.error ||
    outcomesRes.error ||
    configRes.error ||
    !configRes.data?.config;

  const contestants = useSeed
    ? (contestantsSeed as { id: string; pre_merge_price: number }[]).map(
        (c) => ({ id: c.id, pre_merge_price: c.pre_merge_price })
      )
    : (contestantsRes.data ?? []);
  const outcomes = useSeed
    ? (episodeOutcomesSeed as EpisodeOutcome[]).filter(
        (ep) => (ep.episode_id ?? 0) <= through
      )
    : (outcomesRes.data ?? []).map((r) => ({
        ...(r.outcome as Record<string, unknown>),
        episode_id: r.episode_id,
      })) as EpisodeOutcome[];
  const scoringConfig = (useSeed
    ? scoringConfigSeed
    : configRes.data?.config) as ScoringConfig;

  const basePrices = Object.fromEntries(
    contestants.map((c) => [c.id, c.pre_merge_price as number])
  );

  const eliminated = new Set<string>();
  const priceByEpisode: Record<
    number,
    Record<string, { price: number; change: number }>
  > = {};

  for (let ep = 1; ep <= through; ep++) {
    const outcome = outcomes.find((o) => o.episode_id === ep);
    if (!outcome) {
      const prevEpPrices = priceByEpisode[ep - 1];
      const fallback = Object.fromEntries(
        contestants.map((c) => {
          const cid = c.id;
          const basePrice = basePrices[cid] ?? 150000;
          const prev = prevEpPrices?.[cid]?.price ?? basePrice;
          return [cid, { price: prev, change: 0 }];
        })
      );
      priceByEpisode[ep] = fallback;
      continue;
    }

    const votedOut = outcome.voted_out as string | null;
    if (votedOut) eliminated.add(votedOut);

    const active = outcome.active_contestants ?? [];
    const avgPts =
      active.length > 0
        ? active.reduce(
            (sum, cid) =>
              sum +
              calculateContestantEpisodeBreakdown(
                cid,
                outcome,
                scoringConfig
              ).total,
            0
          ) / active.length
        : 0;

    const prevEpPrices = priceByEpisode[ep - 1];
    const episodePrices: Record<string, { price: number; change: number }> = {};

    for (const c of contestants) {
      const cid = c.id;
      const basePrice = basePrices[cid] ?? 150000;

      if (eliminated.has(cid)) {
        const prev = prevEpPrices?.[cid]?.price ?? basePrice;
        episodePrices[cid] = { price: prev, change: 0 };
        continue;
      }

      if (!active.includes(cid)) {
        const prev = prevEpPrices?.[cid]?.price ?? basePrice;
        episodePrices[cid] = { price: prev, change: 0 };
        continue;
      }

      const { total: pts } = calculateContestantEpisodeBreakdown(
        cid,
        outcome,
        scoringConfig
      );
      const prevPrice = prevEpPrices?.[cid]?.price ?? basePrice;
      const perfRatio =
        avgPts !== 0 ? (pts - avgPts) / Math.abs(avgPts) : 0;
      const adjustment = Math.round(
        prevPrice * 0.03 * Math.max(-1, Math.min(1, perfRatio))
      );
      const newPrice = Math.max(
        50000,
        Math.min(300000, prevPrice + adjustment)
      );
      const rounded = Math.round(newPrice / 5000) * 5000;

      episodePrices[cid] = { price: rounded, change: rounded - prevPrice };
    }

    priceByEpisode[ep] = episodePrices;
  }

  let rowCount = 0;
  for (let ep = 1; ep <= through; ep++) {
    const episodePrices = priceByEpisode[ep];
    if (!episodePrices) continue;

    const rows = Object.entries(episodePrices).map(
      ([contestant_id, { price, change }]) => ({
        episode_id: ep,
        contestant_id,
        price,
        price_change: change,
      })
    );

    const { error } = await admin
      .from("contestant_episode_prices")
      .upsert(rows, {
        onConflict: "episode_id,contestant_id",
        ignoreDuplicates: false,
      });

    if (error) throw new Error(`materializePrices episode ${ep}: ${error.message}`);
    rowCount += rows.length;
  }

  return { episodeCount: through, rowCount };
}
