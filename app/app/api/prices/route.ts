import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateContestantEpisodeBreakdown } from "@/lib/scoring";
import type { EpisodeOutcome, ScoringConfig } from "@/lib/scoring";
import contestantsSeed from "@/seed/contestants.json";
import episodeOutcomesSeed from "@/seed/episode_outcomes.json";
import scoringConfigSeed from "@/seed/scoring_config.json";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const through = Math.max(1, parseInt(searchParams.get("through") ?? "1", 10));

    const [contestantsRes, outcomesRes, configRes] = await Promise.all([
      supabase.from("contestants").select("id, pre_merge_price").order("id"),
      supabase.from("episode_outcomes").select("episode_id, outcome").order("episode_id").lte("episode_id", through),
      supabase.from("scoring_config").select("config").eq("id", "default").single(),
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

    const eliminated = new Set<string>();
    const priceByEpisode: Record<number, Record<string, { price: number; change?: number }>> = {};
    const basePrices = Object.fromEntries(
      contestants.map((c) => [c.id, c.pre_merge_price as number])
    );

    for (let ep = 1; ep <= through; ep++) {
      const outcome = outcomes.find((o) => o.episode_id === ep);
      if (!outcome) continue;

      const votedOut = outcome.voted_out as string | null;
      if (votedOut) eliminated.add(votedOut);

      const active = outcome.active_contestants ?? [];
      const avgPts =
        active.length > 0
          ? active.reduce(
              (sum, cid) =>
                sum +
                calculateContestantEpisodeBreakdown(cid, outcome, scoringConfig)
                  .total,
              0
            ) / active.length
          : 0;

      const episodePrices: Record<string, { price: number; change?: number }> = {};
      const prevEpPrices = priceByEpisode[ep - 1];

      for (const c of contestants) {
        const cid = c.id;
        const basePrice = basePrices[cid] ?? 150000;

        if (eliminated.has(cid)) {
          // Voted-out players keep their last price for selling (you can still sell them for their value)
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
        const perfRatio = avgPts !== 0 ? (pts - avgPts) / Math.abs(avgPts) : 0;
        const adjustment = Math.round(prevPrice * 0.03 * Math.max(-1, Math.min(1, perfRatio)));
        const newPrice = Math.max(50000, Math.min(300000, prevPrice + adjustment));
        const rounded = Math.round(newPrice / 5000) * 5000;

        episodePrices[cid] = { price: rounded, change: rounded - prevPrice };
      }

      priceByEpisode[ep] = episodePrices;
    }

    return NextResponse.json({
      through,
      prices: priceByEpisode,
      base_prices: basePrices,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
