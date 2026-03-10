/**
 * Admin API for price adjustment config (category weights and adjustment rate).
 * Stored inside scoring_config.config as price_adjustment_rate and price_adjustment_weights.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DEFAULT_ADJUSTMENT_RATE = 0.03;

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

/** GET: return { adjustment_rate: number, weights: Record<string, number> } */
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
  const weights = (config.price_adjustment_weights as Record<string, number>) ?? {};

  return NextResponse.json({ adjustment_rate, weights });
}

/** PATCH: body { adjustment_rate?: number, weights?: Record<string, number> }; merge into scoring_config */
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

  let body: { adjustment_rate?: number; weights?: Record<string, number> };
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
  const weights = (config.price_adjustment_weights as Record<string, number>) ?? {};

  return NextResponse.json({ adjustment_rate, weights });
}
