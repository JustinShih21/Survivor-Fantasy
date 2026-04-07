import type { ExternalMarket, ExternalMarketPage } from "@/lib/markets/types";

const DEFAULT_KALSHI_BASE_URL = "https://api.elections.kalshi.com";
const DEFAULT_TIMEOUT_MS = 15000;

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeMarket(value: unknown): ExternalMarket | null {
  if (value == null || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const ticker = toStringOrNull(row.ticker);
  if (!ticker) return null;

  return {
    ticker,
    eventTicker: toStringOrNull(row.event_ticker),
    title: toStringOrNull(row.title),
    subtitle: toStringOrNull(row.subtitle),
    status: toStringOrNull(row.status),
    openTime: toStringOrNull(row.open_time),
    closeTime: toStringOrNull(row.close_time),
    expirationTime: toStringOrNull(row.expiration_time),
    yesBidDollars: toNumber(row.yes_bid_dollars),
    yesAskDollars: toNumber(row.yes_ask_dollars),
    noBidDollars: toNumber(row.no_bid_dollars),
    noAskDollars: toNumber(row.no_ask_dollars),
    lastPriceDollars: toNumber(row.last_price_dollars),
    volumeFp: toNumber(row.volume_fp),
    openInterestFp: toNumber(row.open_interest_fp),
    liquidityDollars: toNumber(row.liquidity_dollars),
    raw: row,
  };
}

export class KalshiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; timeoutMs?: number }) {
    this.baseUrl =
      options?.baseUrl ??
      process.env.KALSHI_API_BASE_URL ??
      DEFAULT_KALSHI_BASE_URL;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async fetchJson(path: string, query?: Record<string, string | number | undefined | null>) {
    const url = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v == null) continue;
      url.searchParams.set(k, String(v));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Kalshi request failed (${response.status}): ${text || response.statusText}`);
      }

      return (await response.json()) as Record<string, unknown>;
    } finally {
      clearTimeout(timer);
    }
  }

  async listMarketsPage(params?: {
    cursor?: string | null;
    limit?: number;
    status?: string;
    eventTicker?: string;
  }): Promise<ExternalMarketPage> {
    const payload = await this.fetchJson("/trade-api/v2/markets", {
      cursor: params?.cursor ?? undefined,
      limit: params?.limit ?? undefined,
      status: params?.status ?? undefined,
      event_ticker: params?.eventTicker ?? undefined,
    });

    const rawMarkets = Array.isArray(payload.markets) ? payload.markets : [];
    const markets: ExternalMarket[] = [];
    for (const item of rawMarkets) {
      const normalized = normalizeMarket(item);
      if (normalized) markets.push(normalized);
    }

    const cursor = typeof payload.cursor === "string" ? payload.cursor : null;

    return { markets, cursor };
  }
}
