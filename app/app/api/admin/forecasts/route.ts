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
    if (msg.includes("Admin client not configured")) return null;
    throw e;
  }
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
  const episode = parseInt(searchParams.get("episode") ?? "", 10);
  const model = searchParams.get("model")?.trim() || "kalshi-v1";

  if (!Number.isInteger(episode) || episode < 1) {
    return NextResponse.json({ error: "episode must be a positive integer" }, { status: 400 });
  }

  const [forecastRes, contestantRes, runRes] = await Promise.all([
    admin
      .from("contestant_opportunity_forecasts")
      .select("contestant_id, category, probability, expected_value, model_version, created_at")
      .eq("episode_id", episode)
      .eq("model_version", model)
      .order("contestant_id", { ascending: true })
      .order("category", { ascending: true }),
    admin.from("contestants").select("id, name"),
    admin
      .from("opportunity_forecast_runs")
      .select("run_at, status, summary")
      .eq("target_episode_id", episode)
      .eq("model_version", model)
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (forecastRes.error) {
    return NextResponse.json({ error: forecastRes.error.message }, { status: 500 });
  }
  if (contestantRes.error) {
    return NextResponse.json({ error: contestantRes.error.message }, { status: 500 });
  }

  const nameById = new Map(
    ((contestantRes.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name])
  );
  const rows = ((forecastRes.data ?? []) as {
    contestant_id: string;
    category: string;
    probability: number | string | null;
    expected_value: number | string | null;
    model_version: string | null;
    created_at: string;
  }[]).map((row) => ({
    contestant_id: row.contestant_id,
    contestant_name: nameById.get(row.contestant_id) ?? row.contestant_id,
    category: row.category,
    probability: row.probability == null ? null : toNumber(row.probability),
    expected_value: row.expected_value == null ? null : toNumber(row.expected_value),
    model_version: row.model_version ?? model,
    created_at: row.created_at,
  }));

  return NextResponse.json({
    episode,
    model,
    run_at: runRes.data?.run_at ?? null,
    run_status: runRes.data?.status ?? null,
    run_summary: runRes.data?.summary ?? null,
    forecasts: rows,
  });
}
