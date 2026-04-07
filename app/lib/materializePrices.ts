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
const DEFAULT_OPPORTUNITY_ENABLED = false;
const DEFAULT_OPPORTUNITY_ALPHA = 0;
const DEFAULT_OPPORTUNITY_MIN_COVERAGE = 0.4;
const DEFAULT_MAX_EXTERNAL_COMPONENT_PCT = 0.01;
const DEFAULT_OPPORTUNITY_MODEL_VERSION = "kalshi-v1";

const DEFAULT_PRICE_ADJUSTMENT_WEIGHTS = normalizeNumberMap(
  (scoringConfigSeed as Record<string, unknown>).price_adjustment_weights
);

type PriceAdjustmentConfig = {
  adjustment_rate: number;
  weights: Record<string, number>;
  opportunity_enabled: boolean;
  opportunity_alpha: number;
  opportunity_min_coverage: number;
  max_external_component_pct: number;
  opportunity_model_version: string;
};

export type ContestantPriceBreakdownAudit = {
  weightedScore: number;
  perfRatio: number;
  categoryContributions: Record<string, number>;
  opportunityScore: number;
  opportunityRatio: number;
  blendedRatio: number;
  externalComponent: number;
  opportunityContributions: Record<string, number>;
  forecastModelVersion: string | null;
};

export type MaterializePricesOptions = {
  pointMaterializedEpisodeIds?: number[];
};

export type MaterializePricesResult = {
  episodeCount: number;
  rowCount: number;
  breakdownAudit: Record<number, Record<string, ContestantPriceBreakdownAudit>>;
};

type ForecastRow = {
  episode_id: number;
  contestant_id: string;
  category: string;
  expected_value: number | null;
  model_version: string | null;
};

type OpportunitySummary = {
  score: number;
  contributions: Record<string, number>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeNumberMap(value: unknown): Record<string, number> {
  if (value == null || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = raw;
    }
  }
  return out;
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeBreakdown(value: unknown): Record<string, number> {
  return normalizeNumberMap(value);
}

function getPriceAdjustmentConfig(config: ScoringConfig & Record<string, unknown>): PriceAdjustmentConfig {
  const seed = scoringConfigSeed as Record<string, unknown>;
  const seedRateRaw = seed.price_adjustment_rate;
  const seedRate =
    typeof seedRateRaw === "number" && Number.isFinite(seedRateRaw) && seedRateRaw > 0
      ? seedRateRaw
      : DEFAULT_ADJUSTMENT_RATE;

  const rate = config.price_adjustment_rate;
  const adjustment_rate =
    typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : seedRate;

  const configuredWeights = normalizeNumberMap(config.price_adjustment_weights);
  const weights = {
    ...DEFAULT_PRICE_ADJUSTMENT_WEIGHTS,
    ...configuredWeights,
  };

  const opportunity_enabled =
    typeof config.opportunity_enabled === "boolean"
      ? config.opportunity_enabled
      : DEFAULT_OPPORTUNITY_ENABLED;

  const opportunity_alpha =
    typeof config.opportunity_alpha === "number" && Number.isFinite(config.opportunity_alpha)
      ? clamp(config.opportunity_alpha, 0, 1)
      : DEFAULT_OPPORTUNITY_ALPHA;

  const opportunity_min_coverage =
    typeof config.opportunity_min_coverage === "number" && Number.isFinite(config.opportunity_min_coverage)
      ? clamp(config.opportunity_min_coverage, 0, 1)
      : DEFAULT_OPPORTUNITY_MIN_COVERAGE;

  const max_external_component_pct =
    typeof config.max_external_component_pct === "number" && Number.isFinite(config.max_external_component_pct)
      ? clamp(config.max_external_component_pct, 0, 1)
      : DEFAULT_MAX_EXTERNAL_COMPONENT_PCT;

  const opportunity_model_version =
    typeof config.opportunity_model_version === "string" && config.opportunity_model_version.trim() !== ""
      ? config.opportunity_model_version.trim()
      : DEFAULT_OPPORTUNITY_MODEL_VERSION;

  return {
    adjustment_rate,
    weights,
    opportunity_enabled,
    opportunity_alpha,
    opportunity_min_coverage,
    max_external_component_pct,
    opportunity_model_version,
  };
}

function breakdownFromSources(sources: { label: string; points: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { label, points } of sources) {
    out[label] = (out[label] ?? 0) + points;
  }
  return out;
}

function categoryContributions(
  breakdown: Record<string, number>,
  weights: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [label, points] of Object.entries(breakdown)) {
    const w = weights[label] ?? 1;
    out[label] = w * points;
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

function breakdownKey(episodeId: number, contestantId: string): string {
  return `${episodeId}:${contestantId}`;
}

function getContestantBreakdown(params: {
  contestantId: string;
  episodeId: number;
  outcome: EpisodeOutcome;
  scoringConfig: ScoringConfig;
  pointBreakdownByKey: Map<string, Record<string, number>>;
  pointMaterializedEpisodeSet: Set<number> | null;
}): Record<string, number> {
  const {
    contestantId,
    episodeId,
    outcome,
    scoringConfig,
    pointBreakdownByKey,
    pointMaterializedEpisodeSet,
  } = params;

  const shouldReadCanonicalPoints =
    pointMaterializedEpisodeSet == null || pointMaterializedEpisodeSet.has(episodeId);

  if (shouldReadCanonicalPoints) {
    const stored = pointBreakdownByKey.get(breakdownKey(episodeId, contestantId));
    if (stored) return stored;
  }

  const { sources } = calculateContestantEpisodeBreakdown(contestantId, outcome, scoringConfig);
  return breakdownFromSources(sources);
}

function getOpportunityByEpisode(
  forecastRows: ForecastRow[],
  modelVersion: string,
  weights: Record<string, number>
): Map<number, Map<string, OpportunitySummary>> {
  const byEpisode = new Map<number, Map<string, OpportunitySummary>>();

  for (const row of forecastRows) {
    if ((row.model_version ?? "") !== modelVersion) continue;
    const ev = toFiniteNumber(row.expected_value);
    if (ev == null) continue;

    const weightedEv = (weights[row.category] ?? 1) * ev;

    let byContestant = byEpisode.get(row.episode_id);
    if (!byContestant) {
      byContestant = new Map();
      byEpisode.set(row.episode_id, byContestant);
    }

    const existing = byContestant.get(row.contestant_id);
    if (existing) {
      existing.score += weightedEv;
      existing.contributions[row.category] =
        (existing.contributions[row.category] ?? 0) + weightedEv;
    } else {
      byContestant.set(row.contestant_id, {
        score: weightedEv,
        contributions: { [row.category]: weightedEv },
      });
    }
  }

  return byEpisode;
}

function defaultAudit(): ContestantPriceBreakdownAudit {
  return {
    weightedScore: 0,
    perfRatio: 0,
    categoryContributions: {},
    opportunityScore: 0,
    opportunityRatio: 0,
    blendedRatio: 0,
    externalComponent: 0,
    opportunityContributions: {},
    forecastModelVersion: null,
  };
}

export async function materializePricesForEpisodes(
  through: number,
  admin: SupabaseClient,
  options: MaterializePricesOptions = {}
): Promise<MaterializePricesResult> {
  const [contestantsRes, outcomesRes, configRes, pointsRes, forecastsRes] = await Promise.all([
    admin.from("contestants").select("id, pre_merge_price").order("id"),
    admin
      .from("episode_outcomes")
      .select("episode_id, outcome")
      .order("episode_id")
      .lte("episode_id", through),
    admin.from("scoring_config").select("config").eq("id", "default").single(),
    admin
      .from("contestant_episode_points")
      .select("episode_id, contestant_id, breakdown")
      .lte("episode_id", through),
    admin
      .from("contestant_opportunity_forecasts")
      .select("episode_id, contestant_id, category, expected_value, model_version")
      .lte("episode_id", through + 1),
  ]);

  const useSeed =
    contestantsRes.error ||
    outcomesRes.error ||
    configRes.error ||
    !configRes.data?.config;

  const contestants = useSeed
    ? (contestantsSeed as { id: string; pre_merge_price: number }[]).map((c) => ({
        id: c.id,
        pre_merge_price: c.pre_merge_price,
      }))
    : ((contestantsRes.data ?? []) as { id: string; pre_merge_price: number }[]);

  const outcomes = useSeed
    ? (episodeOutcomesSeed as EpisodeOutcome[]).filter((ep) => (ep.episode_id ?? 0) <= through)
    : ((outcomesRes.data ?? []).map((r) => ({
        ...(r.outcome as Record<string, unknown>),
        episode_id: r.episode_id,
      })) as EpisodeOutcome[]);

  const scoringConfig = (useSeed ? scoringConfigSeed : configRes.data?.config) as ScoringConfig &
    Record<string, unknown>;

  const {
    adjustment_rate,
    weights,
    opportunity_enabled,
    opportunity_alpha,
    opportunity_min_coverage,
    max_external_component_pct,
    opportunity_model_version,
  } = getPriceAdjustmentConfig(scoringConfig);

  const pointBreakdownByKey = new Map<string, Record<string, number>>();
  if (!pointsRes.error) {
    const rows = (pointsRes.data ?? []) as {
      episode_id: number;
      contestant_id: string;
      breakdown: unknown;
    }[];

    for (const row of rows) {
      pointBreakdownByKey.set(
        breakdownKey(row.episode_id, row.contestant_id),
        normalizeBreakdown(row.breakdown)
      );
    }
  }

  const opportunityByEpisode = getOpportunityByEpisode(
    forecastsRes.error
      ? []
      : ((forecastsRes.data ?? []) as ForecastRow[]),
    opportunity_model_version,
    weights
  );

  const pointMaterializedEpisodeSet =
    options.pointMaterializedEpisodeIds && options.pointMaterializedEpisodeIds.length > 0
      ? new Set(options.pointMaterializedEpisodeIds)
      : null;

  const basePrices = Object.fromEntries(contestants.map((c) => [c.id, c.pre_merge_price as number]));

  const eliminated = new Set<string>();
  const priceByEpisode: Record<
    number,
    Record<string, { prevPrice: number; price: number; change: number }>
  > = {};
  const breakdownAudit: Record<number, Record<string, ContestantPriceBreakdownAudit>> = {};
  const fieldAvgWeightedScoreByEpisode: Record<number, number> = {};
  const fieldAvgOpportunityScoreByEpisode: Record<number, number> = {};

  for (let ep = 1; ep <= through; ep++) {
    const outcome = outcomes.find((o) => o.episode_id === ep);
    const prevEpPrices = priceByEpisode[ep - 1];

    if (!outcome) {
      const fallback: Record<string, { prevPrice: number; price: number; change: number }> = {};
      const fallbackAudit: Record<string, ContestantPriceBreakdownAudit> = {};

      for (const c of contestants) {
        const cid = c.id;
        const basePrice = basePrices[cid] ?? 150000;
        const prev = prevEpPrices?.[cid]?.price ?? basePrice;
        fallback[cid] = { prevPrice: prev, price: prev, change: 0 };
        fallbackAudit[cid] = defaultAudit();
      }

      priceByEpisode[ep] = fallback;
      breakdownAudit[ep] = fallbackAudit;
      fieldAvgWeightedScoreByEpisode[ep] = 0;
      fieldAvgOpportunityScoreByEpisode[ep] = 0;
      continue;
    }

    const votedOut = outcome.voted_out as string | null;
    if (votedOut) eliminated.add(votedOut);

    const active = outcome.active_contestants ?? [];
    const activeSet = new Set(active);
    const breakdownByContestant = new Map<string, Record<string, number>>();

    const weightedScores: number[] = [];
    for (const cid of active) {
      const breakdown = getContestantBreakdown({
        contestantId: cid,
        episodeId: ep,
        outcome,
        scoringConfig: scoringConfig as ScoringConfig,
        pointBreakdownByKey,
        pointMaterializedEpisodeSet,
      });
      breakdownByContestant.set(cid, breakdown);
      weightedScores.push(weightedScore(breakdown, weights));
    }

    const avgWeighted =
      weightedScores.length > 0
        ? weightedScores.reduce((a, b) => a + b, 0) / weightedScores.length
        : 0;

    fieldAvgWeightedScoreByEpisode[ep] = avgWeighted;

    const targetForecastEpisode = ep + 1;
    const opportunityByContestant = opportunityByEpisode.get(targetForecastEpisode) ?? new Map();
    const activeOpportunityScores = active.map((cid) => opportunityByContestant.get(cid)?.score ?? 0);
    const avgOpportunity =
      activeOpportunityScores.length > 0
        ? activeOpportunityScores.reduce((a, b) => a + b, 0) / activeOpportunityScores.length
        : 0;
    fieldAvgOpportunityScoreByEpisode[ep] = avgOpportunity;

    const forecastCoverage =
      active.length > 0
        ? active.filter((cid) => opportunityByContestant.has(cid)).length / active.length
        : 0;

    const shouldBlend =
      opportunity_enabled &&
      opportunity_alpha > 0 &&
      forecastCoverage >= opportunity_min_coverage;

    const episodePrices: Record<string, { prevPrice: number; price: number; change: number }> = {};
    const episodeAudit: Record<string, ContestantPriceBreakdownAudit> = {};

    for (const c of contestants) {
      const cid = c.id;
      const basePrice = basePrices[cid] ?? 150000;
      const prevPrice = prevEpPrices?.[cid]?.price ?? basePrice;

      if (eliminated.has(cid) || !activeSet.has(cid)) {
        episodePrices[cid] = { prevPrice, price: prevPrice, change: 0 };
        episodeAudit[cid] = defaultAudit();
        continue;
      }

      const breakdown =
        breakdownByContestant.get(cid) ??
        getContestantBreakdown({
          contestantId: cid,
          episodeId: ep,
          outcome,
          scoringConfig: scoringConfig as ScoringConfig,
          pointBreakdownByKey,
          pointMaterializedEpisodeSet,
        });

      const wScore = weightedScore(breakdown, weights);
      const perfDenom = Math.abs(avgWeighted) || 1e-9;
      const perfRatio = clamp((wScore - avgWeighted) / perfDenom, -1, 1);

      const opportunity = opportunityByContestant.get(cid);
      const opportunityScore = opportunity?.score ?? 0;
      const oppDenom = Math.abs(avgOpportunity) || 1e-9;
      const opportunityRatio = clamp((opportunityScore - avgOpportunity) / oppDenom, -1, 1);

      const perfDeltaRaw = prevPrice * adjustment_rate * perfRatio;
      let externalComponent = 0;
      let blendedRatio = perfRatio;

      if (shouldBlend) {
        const targetBlendedRatio = clamp(
          (1 - opportunity_alpha) * perfRatio + opportunity_alpha * opportunityRatio,
          -1,
          1
        );
        const targetBlendedDelta = prevPrice * adjustment_rate * targetBlendedRatio;
        const uncappedExternal = targetBlendedDelta - perfDeltaRaw;
        const maxExternalAbs = prevPrice * max_external_component_pct;
        externalComponent = clamp(uncappedExternal, -maxExternalAbs, maxExternalAbs);
        const finalDeltaRaw = perfDeltaRaw + externalComponent;
        const ratioDenom = Math.abs(prevPrice * adjustment_rate) || 1e-9;
        blendedRatio = clamp(finalDeltaRaw / ratioDenom, -1, 1);
      }

      const blendedDeltaRaw = perfDeltaRaw + externalComponent;
      const adjustment = Math.round(blendedDeltaRaw);
      const newPrice = Math.max(PRICE_FLOOR, Math.min(PRICE_CEILING, prevPrice + adjustment));
      const rounded = Math.round(newPrice / PRICE_ROUND) * PRICE_ROUND;

      episodePrices[cid] = { prevPrice, price: rounded, change: rounded - prevPrice };
      episodeAudit[cid] = {
        weightedScore: wScore,
        perfRatio,
        categoryContributions: categoryContributions(breakdown, weights),
        opportunityScore,
        opportunityRatio,
        blendedRatio,
        externalComponent,
        opportunityContributions: opportunity?.contributions ?? {},
        forecastModelVersion: opportunity_model_version,
      };
    }

    priceByEpisode[ep] = episodePrices;
    breakdownAudit[ep] = episodeAudit;
  }

  const runAt = new Date().toISOString();
  let rowCount = 0;
  for (let ep = 1; ep <= through; ep++) {
    const episodePrices = priceByEpisode[ep];
    if (!episodePrices) continue;

    const rows = Object.entries(episodePrices).map(([contestant_id, { price, change }]) => ({
      episode_id: ep,
      contestant_id,
      price,
      price_change: change,
    }));

    const { error } = await admin.from("contestant_episode_prices").upsert(rows, {
      onConflict: "episode_id,contestant_id",
      ignoreDuplicates: false,
    });

    if (error) throw new Error(`materializePrices episode ${ep}: ${error.message}`);

    const episodeAudit = breakdownAudit[ep] ?? {};
    const fieldAvgWeightedScore = fieldAvgWeightedScoreByEpisode[ep] ?? 0;
    const fieldAvgOpportunityScore = fieldAvgOpportunityScoreByEpisode[ep] ?? 0;

    const auditRows = Object.entries(episodePrices).map(
      ([contestant_id, { prevPrice, price, change }]) => {
        const audit = episodeAudit[contestant_id] ?? defaultAudit();

        return {
          run_at: runAt,
          episode_id: ep,
          contestant_id,
          adjustment_rate,
          weights_snapshot: weights,
          prev_price: prevPrice,
          new_price: price,
          price_change: change,
          weighted_score: audit.weightedScore,
          field_avg_weighted_score: fieldAvgWeightedScore,
          perf_ratio: audit.perfRatio,
          category_contributions: audit.categoryContributions,
          blend_alpha: opportunity_alpha,
          opportunity_score: audit.opportunityScore,
          field_avg_opportunity_score: fieldAvgOpportunityScore,
          opportunity_ratio: audit.opportunityRatio,
          blended_ratio: audit.blendedRatio,
          external_component: audit.externalComponent,
          opportunity_contributions: audit.opportunityContributions,
          forecast_model_version: audit.forecastModelVersion,
        };
      }
    );

    const { error: auditError } = await admin.from("price_adjustment_audit").insert(auditRows);
    if (auditError) {
      throw new Error(`materializePrices audit episode ${ep}: ${auditError.message}`);
    }

    rowCount += rows.length;
  }

  return { episodeCount: through, rowCount, breakdownAudit };
}
