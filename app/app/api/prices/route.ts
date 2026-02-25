import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/prices?through=N
 * Reads from canonical contestant_episode_prices. Builds same response shape as before.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const through = Math.max(1, parseInt(searchParams.get("through") ?? "1", 10));

    const { data: priceRows, error } = await supabase
      .from("contestant_episode_prices")
      .select("episode_id, contestant_id, price, price_change")
      .lte("episode_id", through)
      .order("episode_id")
      .order("contestant_id");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const priceByEpisode: Record<
      number,
      Record<string, { price: number; change?: number }>
    > = {};
    const basePrices: Record<string, number> = {};

    for (const row of priceRows ?? []) {
      const r = row as {
        episode_id: number;
        contestant_id: string;
        price: number;
        price_change: number | null;
      };
      if (!priceByEpisode[r.episode_id]) {
        priceByEpisode[r.episode_id] = {};
      }
      priceByEpisode[r.episode_id][r.contestant_id] = {
        price: r.price,
        change: r.price_change ?? undefined,
      };
      if (r.episode_id === 1) {
        basePrices[r.contestant_id] = r.price;
      }
    }

    return NextResponse.json(
      {
        through,
        prices: priceByEpisode,
        base_prices: basePrices,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
