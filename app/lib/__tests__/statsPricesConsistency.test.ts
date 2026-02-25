import { describe, it, expect, vi } from "vitest";
import { GET } from "@/app/api/prices/route";

const mockPriceRows = [
  { episode_id: 1, contestant_id: "c01", price: 150000, price_change: 0 },
  { episode_id: 1, contestant_id: "c02", price: 155000, price_change: 5000 },
];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === "contestant_episode_prices") {
        return {
          select: () => ({
            lte: () => ({
              order: () => ({
                order: () =>
                  Promise.resolve({ data: mockPriceRows, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          order: () => Promise.resolve({ data: null, error: { message: "err" } }),
          lte: () => Promise.resolve({ data: null, error: { message: "err" } }),
          eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: "err" } }) }),
        }),
      };
    },
  }),
}));

describe("Prices API reads from contestant_episode_prices", () => {
  it("GET /api/prices?through=1 returns materialized prices for episode 1", async () => {
    const res = await GET(new Request("https://localhost/api/prices?through=1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      through?: number;
      prices?: Record<number, Record<string, { price: number; change?: number }>>;
      base_prices?: Record<string, number>;
    };
    expect(body.through).toBe(1);
    expect(body.prices?.[1]).toBeDefined();
    expect(body.prices?.[1]?.c01?.price).toBe(150000);
    expect(body.prices?.[1]?.c02?.price).toBe(155000);
    expect(body.base_prices?.c01).toBe(150000);
    expect(body.base_prices?.c02).toBe(155000);
  });
});
