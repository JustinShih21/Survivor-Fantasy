/**
 * Materialize contestant prices per episode into contestant_episode_prices.
 * Supports weighted performance-based adjustment: category weights and adjustment_rate
 * from scoring_config (price_adjustment_weights, price_adjustment_rate). Use admin client for writes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateContestantEpisodeBreakdown } from "@/lib/scoring";
import type { EpisodeOutcome, ScoringConfig } from "@/lib/scoring";
import contestantsSeed from "@/seed/contestants.json";
import episodeOutcomesSeed from "@/seed/episode_outcomes.json";
import scoringConfigSeed from "@/seed/scoring_config.json";

const PRICE_FLOOR = 50000;
const PRICE_CEILING = 300000;
const PRICE_ROUND = 5000;
const DEFAULT_ADJUSTMENT_RATE = 0.03;

type PriceAdjustmentConfig = {
  adjustment_rate: number;
  weights: Record<string, number>;
};

function getPriceAdjustmentConfig(config: ScoringConfig & Record<string, unknown>): PriceAdjustmentConfig {
  const rate = config.price_adjustment_rate;
  const adjustment_rate =
    typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_ADJUSTMENT_RATE;
  const weights = (config.price_adjustment_weights as Record<string, number>) ?? {};
  return { adjustment_rate, weights };
}

function breakdownFromSources(sources: { label: string; points: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { label, points } of sources) {
    out[label] = (out[label] ?? 0) + points;
  }
  return out;
}

function weightedScore(breakdown: Record<string, number>, weights: Record<string, number>): number {
  let sum = 0;
  for (const [label, points] of Object.entries(breakdown)) {
    const w = weights[label] ?? 1;
    sum += w * points;
  }
  return sum;
}

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
    : configRes.data?.config) as ScoringConfig & Record<string, unknown>;

  const { adjustment_rate, weights } = getPriceAdjustmentConfig(scoringConfig);

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
    const weightedScores: number[] = [];
    for (const cid of active) {
      const { sources } = calculateContestantEpisodeBreakdown(
        cid,
        outcome,
        scoringConfig as ScoringConfig
      );
      const breakdown = breakdownFromSources(sources);
      weightedScores.push(weightedScore(breakdown, weights));
    }
    const avgWeighted =
      weightedScores.length > 0
        ? weightedScores.reduce((a, b) => a + b, 0) / weightedScores.length
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

      const { sources } = calculateContestantEpisodeBreakdown(
        cid,
        outcome,
        scoringConfig as ScoringConfig
      );
      const breakdown = breakdownFromSources(sources);
      const wScore = weightedScore(breakdown, weights);
      const prevPrice = prevEpPrices?.[cid]?.price ?? basePrice;
      const denom = Math.abs(avgWeighted) || 1e-9;
      const perfRatio = Math.max(-1, Math.min(1, (wScore - avgWeighted) / denom));
      const adjustment = Math.round(
        prevPrice * adjustment_rate * perfRatio
      );
      const newPrice = Math.max(
        PRICE_FLOOR,
        Math.min(PRICE_CEILING, prevPrice + adjustment)
      );
      const rounded = Math.round(newPrice / PRICE_ROUND) * PRICE_ROUND;

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
