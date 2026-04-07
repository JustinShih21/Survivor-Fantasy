import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/getUser";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { KalshiAdapter } from "@/lib/markets/kalshiAdapter";

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

  let body: {
    status?: string;
    limit?: number;
    max_pages?: number;
    dry_run?: boolean;
    event_ticker?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // optional body
  }

  const status = body.status?.trim() || "open";
  const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 1000);
  const maxPages = Math.min(Math.max(Number(body.max_pages) || 5, 1), 50);
  const dryRun = body.dry_run === true;
  const eventTicker = body.event_ticker?.trim() || undefined;

  const adapter = new KalshiAdapter();
  const allMarkets: Awaited<ReturnType<typeof adapter.listMarketsPage>>["markets"] = [];
  let cursor: string | null = null;
  let pageCount = 0;

  do {
    const page = await adapter.listMarketsPage({
      cursor,
      limit: Math.min(200, limit - allMarkets.length),
      status,
      eventTicker,
    });
    allMarkets.push(...page.markets);
    cursor = page.cursor;
    pageCount += 1;

    if (allMarkets.length >= limit) break;
    if (pageCount >= maxPages) break;
    if (!cursor) break;
  } while (true);

  const trimmedMarkets = allMarkets.slice(0, limit);
  const nowIso = new Date().toISOString();
  const marketRows = trimmedMarkets.map((m) => ({
    ticker: m.ticker,
    event_ticker: m.eventTicker ?? null,
    title: m.title ?? null,
    subtitle: m.subtitle ?? null,
    status: m.status ?? null,
    open_time: m.openTime ?? null,
    close_time: m.closeTime ?? null,
    expiration_time: m.expirationTime ?? null,
    last_seen_at: nowIso,
    raw_json: m.raw,
  }));
  const snapshotRows = trimmedMarkets.map((m) => ({
    ticker: m.ticker,
    yes_bid_dollars: m.yesBidDollars ?? null,
    yes_ask_dollars: m.yesAskDollars ?? null,
    no_bid_dollars: m.noBidDollars ?? null,
    no_ask_dollars: m.noAskDollars ?? null,
    last_price_dollars: m.lastPriceDollars ?? null,
    volume_fp: m.volumeFp ?? null,
    open_interest_fp: m.openInterestFp ?? null,
    liquidity_dollars: m.liquidityDollars ?? null,
    raw_json: m.raw,
  }));

  if (!dryRun) {
    if (marketRows.length > 0) {
      const { error: marketError } = await admin
        .from("kalshi_markets")
        .upsert(marketRows, { onConflict: "ticker", ignoreDuplicates: false });
      if (marketError) {
        return NextResponse.json({ error: marketError.message }, { status: 500 });
      }
    }

    if (snapshotRows.length > 0) {
      const { error: snapshotError } = await admin
        .from("kalshi_market_snapshots")
        .insert(snapshotRows);
      if (snapshotError) {
        return NextResponse.json({ error: snapshotError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    dry_run: dryRun,
    fetched_count: trimmedMarkets.length,
    page_count: pageCount,
    cursor,
    markets_upserted: dryRun ? 0 : marketRows.length,
    snapshots_inserted: dryRun ? 0 : snapshotRows.length,
  });
}
