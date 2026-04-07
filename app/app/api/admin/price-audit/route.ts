import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

function normalizeCategoryContributions(value: unknown): Record<string, number> {
  if (value == null || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [label, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(raw);
    if (Number.isFinite(n)) out[label] = n;
  }
  return out;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const episodeParam = searchParams.get("episode");
  const episode = episodeParam != null ? parseInt(episodeParam, 10) : NaN;
  if (!Number.isInteger(episode) || episode < 1) {
    return NextResponse.json({ error: "Valid episode query parameter required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("price_adjustment_audit")
    .select(
      "run_at, episode_id, contestant_id, adjustment_rate, prev_price, new_price, price_change, weighted_score, field_avg_weighted_score, perf_ratio, category_contributions"
    )
    .eq("episode_id", episode)
    .order("run_at", { ascending: false })
    .order("perf_ratio", { ascending: false })
    .order("contestant_id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as {
    run_at: string;
    episode_id: number;
    contestant_id: string;
    adjustment_rate: number | string;
    prev_price: number;
    new_price: number;
    price_change: number;
    weighted_score: number | string;
    field_avg_weighted_score: number | string;
    perf_ratio: number | string;
    category_contributions: unknown;
  }[];

  if (rows.length === 0) {
    return NextResponse.json({
      episode,
      run_at: null,
      adjustment_rate: null,
      contestants: [],
    });
  }

  const latestRunAt = rows[0].run_at;
  const runRows = rows
    .filter((row) => row.run_at === latestRunAt)
    .sort((a, b) => toNumber(b.perf_ratio) - toNumber(a.perf_ratio));

  return NextResponse.json({
    episode,
    run_at: latestRunAt,
    adjustment_rate: toNumber(runRows[0]?.adjustment_rate ?? 0),
    contestants: runRows.map((row) => ({
      contestant_id: row.contestant_id,
      prev_price: row.prev_price,
      new_price: row.new_price,
      price_change: row.price_change,
      weighted_score: toNumber(row.weighted_score),
      field_avg: toNumber(row.field_avg_weighted_score),
      perf_ratio: toNumber(row.perf_ratio),
      category_contributions: normalizeCategoryContributions(row.category_contributions),
    })),
  });
}
