import { KalshiClient } from "@/lib/markets/kalshiClient";
import type { ExternalMarketPage, PredictionMarketAdapter } from "@/lib/markets/types";

export class KalshiAdapter implements PredictionMarketAdapter {
  constructor(private readonly client: KalshiClient = new KalshiClient()) {}

  async listMarketsPage(params?: {
    cursor?: string | null;
    limit?: number;
    status?: string;
    eventTicker?: string;
  }): Promise<ExternalMarketPage> {
    return this.client.listMarketsPage(params);
  }
}
