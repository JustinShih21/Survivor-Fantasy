import { describe, it, expect, vi } from "vitest";
import { getPricesForEpisode } from "@/lib/prices";
import { GET } from "@/app/api/prices/route";

vi.mock("@/lib/supabase/server", () => {
  const stub = { data: null, error: { message: "err" } };
  return {
    createClient: vi.fn().mockResolvedValue({
      from: () => ({
        select: () => ({
          order: (col: string) =>
            col === "id"
              ? Promise.resolve(stub)
              : { lte: () => Promise.resolve(stub) },
          eq: () => ({ single: () => Promise.resolve(stub) }),
        }),
      }),
    }),
  };
});

describe("Stats vs Prices API consistency", () => {
  it("getPricesForEpisode(episode) matches prices API for same episode (seed path)", async () => {
    const episode = 1;
    const statsPrices = await getPricesForEpisode(episode);

    const url = `https://localhost/api/prices?through=${episode}`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      prices?: Record<number, Record<string, { price: number }>>;
      base_prices?: Record<string, number>;
    };
    const apiEpisodePrices = body.prices?.[episode];
    const basePrices = body.base_prices ?? {};

    for (const [contestantId, statsPrice] of Object.entries(statsPrices)) {
      const apiPrice =
        apiEpisodePrices?.[contestantId]?.price ?? basePrices[contestantId];
      expect(
        apiPrice,
        `contestant ${contestantId}: stats price ${statsPrice} should equal API/base price`
      ).toBeDefined();
      expect(apiPrice).toBe(statsPrice);
    }

    for (const contestantId of Object.keys(statsPrices)) {
      expect(
        basePrices[contestantId] ?? apiEpisodePrices?.[contestantId]?.price,
        `contestant ${contestantId} should exist in API or base_prices`
      ).toBeDefined();
    }
  });
});
