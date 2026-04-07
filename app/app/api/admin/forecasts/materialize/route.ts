import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { materializeOpportunityForecastsForEpisode } from "@/lib/opportunity/materializeForecasts";

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

export async function POST(request: NextRequest) {
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

  const url = new URL(request.url);
  let body: { episode?: number; model?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // optional body
  }

  const episodeParam =
    body.episode ??
    (url.searchParams.get("episode") ? parseInt(url.searchParams.get("episode") ?? "", 10) : NaN);
  if (!Number.isInteger(episodeParam) || episodeParam < 1) {
    return NextResponse.json({ error: "episode must be a positive integer" }, { status: 400 });
  }

  const model =
    body.model?.trim() ||
    url.searchParams.get("model")?.trim() ||
    "kalshi-v1";

  try {
    const result = await materializeOpportunityForecastsForEpisode(
      episodeParam,
      admin,
      { modelVersion: model, provider: "kalshi" }
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Forecast materialization failed" },
      { status: 500 }
    );
  }
}
