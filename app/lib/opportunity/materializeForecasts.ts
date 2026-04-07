import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoringConfig } from "@/lib/scoring";
import scoringConfigSeed from "@/seed/scoring_config.json";
import { getCategoryPointValue } from "@/lib/opportunity/categoryPointValues";

type MappingRow = {
  id: string;
  market_ticker: string;
  contestant_id: string;
  category: string;
  side: "yes" | "no";
  transform: "direct" | "inverse";
  confidence: number;
};

type SnapshotRow = {
  ticker: string;
  captured_at: string;
  yes_bid_dollars: number | null;
  yes_ask_dollars: number | null;
  no_bid_dollars: number | null;
  no_ask_dollars: number | null;
  last_price_dollars: number | null;
  volume_fp: number | null;
  open_interest_fp: number | null;
  liquidity_dollars: number | null;
};

type ForecastAccumulator = {
  episode_id: number;
  contestant_id: string;
  category: string;
  point_value: number;
  weighted_prob_sum: number;
  weight_sum: number;
  sample_count: number;
};

export type MaterializeOpportunityForecastsResult = {
  episodeId: number;
  modelVersion: string;
  mappingCount: number;
  rowCount: number;
  skippedCount: number;
};

const DEFAULT_MODEL_VERSION = "kalshi-v1";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeProbability(raw: number | null): number | null {
  if (raw == null) return null;
  if (raw >= 0 && raw <= 1) return raw;
  if (raw > 1 && raw <= 100) return raw / 100;
  return null;
}

function probabilityFromSnapshot(row: SnapshotRow): number | null {
  const yesBid = normalizeProbability(row.yes_bid_dollars);
  const yesAsk = normalizeProbability(row.yes_ask_dollars);
  const last = normalizeProbability(row.last_price_dollars);

  if (yesBid != null && yesAsk != null) {
    return clamp((yesBid + yesAsk) / 2, 0, 1);
  }
  if (last != null) return clamp(last, 0, 1);
  if (yesBid != null) return clamp(yesBid, 0, 1);
  if (yesAsk != null) return clamp(yesAsk, 0, 1);
  return null;
}

function qualityFromSnapshot(row: SnapshotRow, now: Date): number {
  const yesBid = normalizeProbability(row.yes_bid_dollars);
  const yesAsk = normalizeProbability(row.yes_ask_dollars);
  const spreadComponent =
    yesBid != null && yesAsk != null
      ? clamp(1 - Math.abs(yesAsk - yesBid), 0, 1)
      : 0.5;

  const liquidityRaw =
    (row.volume_fp ?? 0) +
    (row.open_interest_fp ?? 0) +
    ((row.liquidity_dollars ?? 0) * 100);
  const liquidityComponent = clamp(Math.log10(1 + Math.max(0, liquidityRaw)) / 3, 0, 1);

  const capturedAt = new Date(row.captured_at);
  const ageMinutes = Number.isNaN(capturedAt.getTime())
    ? 9999
    : Math.max(0, (now.getTime() - capturedAt.getTime()) / (60 * 1000));
  const freshnessComponent = clamp(Math.exp(-ageMinutes / 240), 0, 1);

  return clamp(
    0.5 * spreadComponent + 0.3 * liquidityComponent + 0.2 * freshnessComponent,
    0,
    1
  );
}

function effectiveProbability(
  baseProb: number,
  side: "yes" | "no",
  transform: "direct" | "inverse"
): number {
  let out = baseProb;
  if (side === "no") out = 1 - out;
  if (transform === "inverse") out = 1 - out;
  return clamp(out, 0, 1);
}

function scoringConfigFromRow(row: unknown): ScoringConfig {
  if (row && typeof row === "object" && !Array.isArray(row)) {
    return row as ScoringConfig;
  }
  return scoringConfigSeed as ScoringConfig;
}

function accKey(episodeId: number, contestantId: string, category: string): string {
  return `${episodeId}:${contestantId}:${category}`;
}

export async function materializeOpportunityForecastsForEpisode(
  episodeId: number,
  admin: SupabaseClient,
  options?: { modelVersion?: string; provider?: "kalshi" }
): Promise<MaterializeOpportunityForecastsResult> {
  const modelVersion = (options?.modelVersion ?? DEFAULT_MODEL_VERSION).trim();
  const provider = options?.provider ?? "kalshi";
  if (!modelVersion) {
    throw new Error("modelVersion is required");
  }
  if (!Number.isInteger(episodeId) || episodeId < 1) {
    throw new Error("episodeId must be a positive integer");
  }

  const [mappingsRes, configRes, episodeRes] = await Promise.all([
    admin
      .from("contestant_market_mappings")
      .select("id, market_ticker, contestant_id, category, side, transform, confidence")
      .eq("provider", provider)
      .eq("episode_id", episodeId)
      .eq("is_active", true),
    admin.from("scoring_config").select("config").eq("id", "default").single(),
    admin.from("episode_outcomes").select("phase").eq("episode_id", episodeId).maybeSingle(),
  ]);

  if (mappingsRes.error) {
    throw new Error(`load mappings: ${mappingsRes.error.message}`);
  }

  const mappings = (mappingsRes.data ?? []) as MappingRow[];
  const scoringConfig = scoringConfigFromRow(configRes.data?.config);
  const phase =
    (episodeRes.data as { phase?: string | null } | null)?.phase ?? null;

  if (mappings.length === 0) {
    const { error: clearError } = await admin
      .from("contestant_opportunity_forecasts")
      .delete()
      .eq("episode_id", episodeId)
      .eq("model_version", modelVersion);
    if (clearError) {
      throw new Error(`clear existing forecasts: ${clearError.message}`);
    }

    const { error: runError } = await admin.from("opportunity_forecast_runs").insert({
      target_episode_id: episodeId,
      provider,
      model_version: modelVersion,
      status: "completed",
      summary: { mappingCount: 0, rowCount: 0, skippedCount: 0 },
    });
    if (runError) {
      throw new Error(`insert forecast run: ${runError.message}`);
    }

    return {
      episodeId,
      modelVersion,
      mappingCount: 0,
      rowCount: 0,
      skippedCount: 0,
    };
  }

  const tickers = [...new Set(mappings.map((m) => m.market_ticker))];
  const snapshotsRes = await admin
    .from("kalshi_market_snapshots")
    .select(
      "ticker, captured_at, yes_bid_dollars, yes_ask_dollars, no_bid_dollars, no_ask_dollars, last_price_dollars, volume_fp, open_interest_fp, liquidity_dollars"
    )
    .in("ticker", tickers)
    .order("captured_at", { ascending: false });

  if (snapshotsRes.error) {
    throw new Error(`load snapshots: ${snapshotsRes.error.message}`);
  }

  const latestSnapshotByTicker = new Map<string, SnapshotRow>();
  const snapshots = (snapshotsRes.data ?? []) as SnapshotRow[];
  for (const row of snapshots) {
    if (!latestSnapshotByTicker.has(row.ticker)) {
      latestSnapshotByTicker.set(row.ticker, row);
    }
  }

  const now = new Date();
  const acc = new Map<string, ForecastAccumulator>();
  let skippedCount = 0;

  for (const mapping of mappings) {
    const snapshot = latestSnapshotByTicker.get(mapping.market_ticker);
    if (!snapshot) {
      skippedCount += 1;
      continue;
    }

    const pointValue = getCategoryPointValue(mapping.category, scoringConfig, { phase });
    if (pointValue == null) {
      skippedCount += 1;
      continue;
    }

    const baseProb = probabilityFromSnapshot(snapshot);
    if (baseProb == null) {
      skippedCount += 1;
      continue;
    }

    const confidence = clamp(toFiniteNumber(mapping.confidence) ?? 1, 0, 5);
    const quality = qualityFromSnapshot(snapshot, now);
    const weight = confidence * quality;
    if (weight <= 0) {
      skippedCount += 1;
      continue;
    }

    const p = effectiveProbability(baseProb, mapping.side, mapping.transform);
    const key = accKey(episodeId, mapping.contestant_id, mapping.category);
    const existing = acc.get(key);

    if (existing) {
      existing.weighted_prob_sum += p * weight;
      existing.weight_sum += weight;
      existing.sample_count += 1;
    } else {
      acc.set(key, {
        episode_id: episodeId,
        contestant_id: mapping.contestant_id,
        category: mapping.category,
        point_value: pointValue,
        weighted_prob_sum: p * weight,
        weight_sum: weight,
        sample_count: 1,
      });
    }
  }

  const rows = [...acc.values()].map((item) => {
    const probability =
      item.weight_sum > 0
        ? clamp(item.weighted_prob_sum / item.weight_sum, 0, 1)
        : 0;
    const expectedValue = probability * item.point_value;
    return {
      episode_id: item.episode_id,
      contestant_id: item.contestant_id,
      category: item.category,
      probability,
      expected_value: expectedValue,
      model_version: modelVersion,
    };
  });

  const { error: deleteError } = await admin
    .from("contestant_opportunity_forecasts")
    .delete()
    .eq("episode_id", episodeId)
    .eq("model_version", modelVersion);
  if (deleteError) {
    throw new Error(`clear existing forecasts: ${deleteError.message}`);
  }

  if (rows.length > 0) {
    const { error: insertError } = await admin
      .from("contestant_opportunity_forecasts")
      .insert(rows);
    if (insertError) {
      throw new Error(`insert forecasts: ${insertError.message}`);
    }
  }

  const summary = {
    mappingCount: mappings.length,
    rowCount: rows.length,
    skippedCount,
  };
  const { error: runError } = await admin.from("opportunity_forecast_runs").insert({
    target_episode_id: episodeId,
    provider,
    model_version: modelVersion,
    status: "completed",
    summary,
  });
  if (runError) {
    throw new Error(`insert forecast run: ${runError.message}`);
  }

  return {
    episodeId,
    modelVersion,
    mappingCount: mappings.length,
    rowCount: rows.length,
    skippedCount,
  };
}
