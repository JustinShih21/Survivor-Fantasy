/**
 * Admin API for price adjustment config (category weights and adjustment rate).
 * Stored inside scoring_config.config as price_adjustment_rate and price_adjustment_weights.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import scoringConfigSeed from "@/seed/scoring_config.json";

export const dynamic = "force-dynamic";

const SEED_RATE = (scoringConfigSeed as Record<string, unknown>).price_adjustment_rate;
const DEFAULT_ADJUSTMENT_RATE =
  typeof SEED_RATE === "number" && Number.isFinite(SEED_RATE) && SEED_RATE > 0 ? SEED_RATE : 0.03;
const DEFAULT_WEIGHTS = normalizeNumberMap(
  (scoringConfigSeed as Record<string, unknown>).price_adjustment_weights
);
const DEFAULT_OPPORTUNITY_ENABLED = false;
const DEFAULT_OPPORTUNITY_ALPHA = 0;
const DEFAULT_OPPORTUNITY_MIN_COVERAGE = 0.4;
const DEFAULT_MAX_EXTERNAL_COMPONENT_PCT = 0.01;
const DEFAULT_OPPORTUNITY_MODEL_VERSION = "kalshi-v1";

function normalizeNumberMap(value: unknown): Record<string, number> {
  if (value == null || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    }
  }
  return out;
}

function getAdminClient() {
  try {
    return createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Admin client not configured")) {
      return null;
    }
    throw e;
  }
}

/** GET: return price adjustment config including optional opportunity blend settings. */
export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("scoring_config")
    .select("config")
    .eq("id", "default")
    .single();

  if (error || !data?.config) {
    return NextResponse.json(
      { error: error?.message ?? "Config not found" },
      { status: error ? 500 : 404 }
    );
  }

  const config = data.config as Record<string, unknown>;
  const rate = config.price_adjustment_rate;
  const adjustment_rate =
    typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_ADJUSTMENT_RATE;
  const weights = {
    ...DEFAULT_WEIGHTS,
    ...normalizeNumberMap(config.price_adjustment_weights),
  };
  const opportunity_enabled =
    typeof config.opportunity_enabled === "boolean"
      ? config.opportunity_enabled
      : DEFAULT_OPPORTUNITY_ENABLED;
  const opportunity_alpha =
    typeof config.opportunity_alpha === "number" &&
    Number.isFinite(config.opportunity_alpha) &&
    config.opportunity_alpha >= 0 &&
    config.opportunity_alpha <= 1
      ? config.opportunity_alpha
      : DEFAULT_OPPORTUNITY_ALPHA;
  const opportunity_min_coverage =
    typeof config.opportunity_min_coverage === "number" &&
    Number.isFinite(config.opportunity_min_coverage) &&
    config.opportunity_min_coverage >= 0 &&
    config.opportunity_min_coverage <= 1
      ? config.opportunity_min_coverage
      : DEFAULT_OPPORTUNITY_MIN_COVERAGE;
  const max_external_component_pct =
    typeof config.max_external_component_pct === "number" &&
    Number.isFinite(config.max_external_component_pct) &&
    config.max_external_component_pct >= 0 &&
    config.max_external_component_pct <= 1
      ? config.max_external_component_pct
      : DEFAULT_MAX_EXTERNAL_COMPONENT_PCT;
  const opportunity_model_version =
    typeof config.opportunity_model_version === "string" &&
    config.opportunity_model_version.trim() !== ""
      ? config.opportunity_model_version.trim()
      : DEFAULT_OPPORTUNITY_MODEL_VERSION;

  return NextResponse.json({
    adjustment_rate,
    weights,
    opportunity_enabled,
    opportunity_alpha,
    opportunity_min_coverage,
    max_external_component_pct,
    opportunity_model_version,
  });
}

/** PATCH merges body fields into scoring_config.config */
export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await isAdmin(auth.supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  let body: {
    adjustment_rate?: number;
    weights?: Record<string, number>;
    opportunity_enabled?: boolean;
    opportunity_alpha?: number;
    opportunity_min_coverage?: number;
    max_external_component_pct?: number;
    opportunity_model_version?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: row, error: fetchError } = await admin
    .from("scoring_config")
    .select("config")
    .eq("id", "default")
    .single();

  if (fetchError || !row?.config) {
    return NextResponse.json(
      { error: fetchError?.message ?? "Config not found" },
      { status: fetchError ? 500 : 404 }
    );
  }

  const config = { ...(row.config as Record<string, unknown>) };

  if (body.adjustment_rate !== undefined) {
    const r = Number(body.adjustment_rate);
    if (!Number.isFinite(r) || r <= 0 || r > 1) {
      return NextResponse.json(
        { error: "adjustment_rate must be a number in (0, 1]" },
        { status: 400 }
      );
    }
    config.price_adjustment_rate = r;
  }

  if (body.weights !== undefined) {
    if (body.weights !== null && typeof body.weights !== "object") {
      return NextResponse.json({ error: "weights must be an object" }, { status: 400 });
    }
    const w = body.weights ?? {};
    for (const [k, v] of Object.entries(w)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        return NextResponse.json(
          { error: `weights["${k}"] must be a non-negative number` },
          { status: 400 }
        );
      }
    }
    config.price_adjustment_weights = w;
  }

  if (body.opportunity_enabled !== undefined) {
    if (typeof body.opportunity_enabled !== "boolean") {
      return NextResponse.json({ error: "opportunity_enabled must be a boolean" }, { status: 400 });
    }
    config.opportunity_enabled = body.opportunity_enabled;
  }

  if (body.opportunity_alpha !== undefined) {
    const alpha = Number(body.opportunity_alpha);
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
      return NextResponse.json({ error: "opportunity_alpha must be in [0, 1]" }, { status: 400 });
    }
    config.opportunity_alpha = alpha;
  }

  if (body.opportunity_min_coverage !== undefined) {
    const coverage = Number(body.opportunity_min_coverage);
    if (!Number.isFinite(coverage) || coverage < 0 || coverage > 1) {
      return NextResponse.json(
        { error: "opportunity_min_coverage must be in [0, 1]" },
        { status: 400 }
      );
    }
    config.opportunity_min_coverage = coverage;
  }

  if (body.max_external_component_pct !== undefined) {
    const cap = Number(body.max_external_component_pct);
    if (!Number.isFinite(cap) || cap < 0 || cap > 1) {
      return NextResponse.json(
        { error: "max_external_component_pct must be in [0, 1]" },
        { status: 400 }
      );
    }
    config.max_external_component_pct = cap;
  }

  if (body.opportunity_model_version !== undefined) {
    if (typeof body.opportunity_model_version !== "string") {
      return NextResponse.json(
        { error: "opportunity_model_version must be a string" },
        { status: 400 }
      );
    }
    const model = body.opportunity_model_version.trim();
    if (!model) {
      return NextResponse.json({ error: "opportunity_model_version cannot be empty" }, { status: 400 });
    }
    config.opportunity_model_version = model;
  }

  const { error: updateError } = await admin
    .from("scoring_config")
    .update({ config })
    .eq("id", "default");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const rate = config.price_adjustment_rate as number | undefined;
  const adjustment_rate =
    typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_ADJUSTMENT_RATE;
  const weights = {
    ...DEFAULT_WEIGHTS,
    ...normalizeNumberMap(config.price_adjustment_weights),
  };
  const opportunity_enabled =
    typeof config.opportunity_enabled === "boolean"
      ? config.opportunity_enabled
      : DEFAULT_OPPORTUNITY_ENABLED;
  const opportunity_alpha =
    typeof config.opportunity_alpha === "number" &&
    Number.isFinite(config.opportunity_alpha) &&
    config.opportunity_alpha >= 0 &&
    config.opportunity_alpha <= 1
      ? config.opportunity_alpha
      : DEFAULT_OPPORTUNITY_ALPHA;
  const opportunity_min_coverage =
    typeof config.opportunity_min_coverage === "number" &&
    Number.isFinite(config.opportunity_min_coverage) &&
    config.opportunity_min_coverage >= 0 &&
    config.opportunity_min_coverage <= 1
      ? config.opportunity_min_coverage
      : DEFAULT_OPPORTUNITY_MIN_COVERAGE;
  const max_external_component_pct =
    typeof config.max_external_component_pct === "number" &&
    Number.isFinite(config.max_external_component_pct) &&
    config.max_external_component_pct >= 0 &&
    config.max_external_component_pct <= 1
      ? config.max_external_component_pct
      : DEFAULT_MAX_EXTERNAL_COMPONENT_PCT;
  const opportunity_model_version =
    typeof config.opportunity_model_version === "string" &&
    config.opportunity_model_version.trim() !== ""
      ? config.opportunity_model_version.trim()
      : DEFAULT_OPPORTUNITY_MODEL_VERSION;

  return NextResponse.json({
    adjustment_rate,
    weights,
    opportunity_enabled,
    opportunity_alpha,
    opportunity_min_coverage,
    max_external_component_pct,
    opportunity_model_version,
  });
}
