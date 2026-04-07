export interface ExternalMarket {
  ticker: string;
  eventTicker?: string | null;
  title?: string | null;
  subtitle?: string | null;
  status?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  expirationTime?: string | null;
  yesBidDollars?: number | null;
  yesAskDollars?: number | null;
  noBidDollars?: number | null;
  noAskDollars?: number | null;
  lastPriceDollars?: number | null;
  volumeFp?: number | null;
  openInterestFp?: number | null;
  liquidityDollars?: number | null;
  raw: Record<string, unknown>;
}

export interface ExternalMarketPage {
  markets: ExternalMarket[];
  cursor: string | null;
}

export interface IngestedMarketResult {
  marketsUpserted: number;
  snapshotsInserted: number;
  cursor: string | null;
}

export interface PredictionMarketAdapter {
  listMarketsPage(params?: {
    cursor?: string | null;
    limit?: number;
    status?: string;
    eventTicker?: string;
  }): Promise<ExternalMarketPage>;
}
