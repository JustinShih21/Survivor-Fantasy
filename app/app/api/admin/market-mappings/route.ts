import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALLOWED_PROVIDERS = new Set(["kalshi"]);
const ALLOWED_SIDES = new Set(["yes", "no"]);
const ALLOWED_TRANSFORMS = new Set(["direct", "inverse"]);

function getAdminClient() {
  try {
    return createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Admin client not configured")) return null;
    throw e;
  }
}

async function requireAdmin() {
  const auth = await getAuthenticatedUser();
  if (!auth) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (!(await isAdmin(auth.supabase))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const admin = getAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: "Server configuration error" }, { status: 503 }) };
  }
  return { admin };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { admin } = auth;

  const { searchParams } = new URL(request.url);
  const episodeParam = searchParams.get("episode");
  const provider = searchParams.get("provider")?.trim() || "kalshi";
  const includeInactive = searchParams.get("include_inactive") === "true";

  let query = admin
    .from("contestant_market_mappings")
    .select(
      "id, provider, market_ticker, episode_id, contestant_id, category, side, transform, confidence, is_active, notes, created_at, updated_at"
    )
    .eq("provider", provider)
    .order("episode_id", { ascending: true })
    .order("contestant_id", { ascending: true })
    .order("category", { ascending: true });

  if (episodeParam) {
    const episode = parseInt(episodeParam, 10);
    if (!Number.isInteger(episode) || episode < 1) {
      return NextResponse.json({ error: "episode must be a positive integer" }, { status: 400 });
    }
    query = query.eq("episode_id", episode);
  }

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { admin } = auth;

  let body: {
    provider?: string;
    market_ticker?: string;
    episode_id?: number;
    contestant_id?: string;
    category?: string;
    side?: string;
    transform?: string;
    confidence?: number;
    is_active?: boolean;
    notes?: string | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const provider = body.provider?.trim() || "kalshi";
  const market_ticker = body.market_ticker?.trim();
  const episode_id = Number(body.episode_id);
  const contestant_id = body.contestant_id?.trim();
  const category = body.category?.trim();
  const side = body.side?.trim() || "yes";
  const transform = body.transform?.trim() || "direct";
  const confidence = Number.isFinite(Number(body.confidence)) ? Number(body.confidence) : 1;
  const is_active = body.is_active ?? true;
  const notes = body.notes?.trim() || null;

  if (!ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "provider must be 'kalshi'" }, { status: 400 });
  }
  if (!market_ticker) {
    return NextResponse.json({ error: "market_ticker is required" }, { status: 400 });
  }
  if (!Number.isInteger(episode_id) || episode_id < 1) {
    return NextResponse.json({ error: "episode_id must be a positive integer" }, { status: 400 });
  }
  if (!contestant_id) {
    return NextResponse.json({ error: "contestant_id is required" }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }
  if (!ALLOWED_SIDES.has(side)) {
    return NextResponse.json({ error: "side must be 'yes' or 'no'" }, { status: 400 });
  }
  if (!ALLOWED_TRANSFORMS.has(transform)) {
    return NextResponse.json({ error: "transform must be 'direct' or 'inverse'" }, { status: 400 });
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 5) {
    return NextResponse.json({ error: "confidence must be a number in [0, 5]" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("contestant_market_mappings")
    .upsert(
      {
        provider,
        market_ticker,
        episode_id,
        contestant_id,
        category,
        side,
        transform,
        confidence,
        is_active,
        notes,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "provider,market_ticker,episode_id,contestant_id,category",
        ignoreDuplicates: false,
      }
    )
    .select(
      "id, provider, market_ticker, episode_id, contestant_id, category, side, transform, confidence, is_active, notes, created_at, updated_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
