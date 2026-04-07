# Prediction Market Integration Spec (Kalshi-first)

## 1) Objective
Add an external-signal pipeline that ingests prediction market data (starting with Kalshi), maps market probabilities to contestant point categories, materializes `contestant_opportunity_forecasts`, and blends that signal into dynamic pricing with full auditability.

## 2) Scope
- In scope:
  - Kalshi market data ingestion (REST polling)
  - Market-to-contestant/category mapping
  - Forecast materialization into `contestant_opportunity_forecasts`
  - Optional blend into `materializePricesForEpisodes`
  - Admin controls, preview, and audit fields
- Out of scope:
  - Auto-trading/order execution
  - Non-Kalshi provider implementation (design for adapter, implement Kalshi only)
  - ML model training (use market-implied probabilities only in v1)

## 3) High-level architecture
1. Ingest raw Kalshi market snapshots.
2. Map market tickers to `(episode_id, contestant_id, category)`.
3. Convert market price -> probability and quality score.
4. Compute per-category expected value and write `contestant_opportunity_forecasts`.
5. Blend opportunity signal into repricing (shadow mode first, then gated rollout).
6. Persist explainability in `price_adjustment_audit`.

## 4) Data model changes

### 4.1 New migrations
Use next available numbers after current head.

#### Migration A: `kalshi_markets` and `kalshi_market_snapshots`
```sql
CREATE TABLE kalshi_markets (
  ticker TEXT PRIMARY KEY,
  event_ticker TEXT,
  title TEXT,
  subtitle TEXT,
  status TEXT,
  open_time TIMESTAMPTZ,
  close_time TIMESTAMPTZ,
  expiration_time TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_json JSONB NOT NULL
);

CREATE TABLE kalshi_market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL REFERENCES kalshi_markets(ticker) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  yes_bid_dollars NUMERIC,
  yes_ask_dollars NUMERIC,
  no_bid_dollars NUMERIC,
  no_ask_dollars NUMERIC,
  last_price_dollars NUMERIC,
  volume_fp NUMERIC,
  open_interest_fp NUMERIC,
  liquidity_dollars NUMERIC,
  raw_json JSONB NOT NULL
);

CREATE INDEX idx_kalshi_market_snapshots_ticker_time
  ON kalshi_market_snapshots(ticker, captured_at DESC);
```

#### Migration B: `contestant_market_mappings`
```sql
CREATE TABLE contestant_market_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('kalshi')),
  market_ticker TEXT NOT NULL REFERENCES kalshi_markets(ticker) ON DELETE CASCADE,
  episode_id INTEGER NOT NULL,
  contestant_id TEXT NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  side TEXT NOT NULL DEFAULT 'yes' CHECK (side IN ('yes','no')),
  transform TEXT NOT NULL DEFAULT 'direct' CHECK (transform IN ('direct','inverse')),
  confidence NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, market_ticker, episode_id, contestant_id, category)
);

CREATE INDEX idx_contestant_market_mappings_episode
  ON contestant_market_mappings(episode_id, contestant_id);
```

#### Migration C: Forecast run metadata
```sql
CREATE TABLE opportunity_forecast_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_episode_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model_version TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'completed',
  summary JSONB NOT NULL DEFAULT '{}'
);
```

#### Migration D: Extend price audit for external blend explainability
```sql
ALTER TABLE price_adjustment_audit
  ADD COLUMN blend_alpha NUMERIC,
  ADD COLUMN opportunity_score NUMERIC,
  ADD COLUMN field_avg_opportunity_score NUMERIC,
  ADD COLUMN opportunity_ratio NUMERIC,
  ADD COLUMN blended_ratio NUMERIC,
  ADD COLUMN external_component NUMERIC,
  ADD COLUMN opportunity_contributions JSONB,
  ADD COLUMN forecast_model_version TEXT;
```

### 4.2 RLS
- `kalshi_*`, `contestant_market_mappings`, `opportunity_forecast_runs`:
  - `SELECT` for authenticated/admin.
  - writes by service role only (admin API uses service role client).

## 5) Provider integration (Kalshi)

## 5.1 Kalshi endpoints (REST)
- `GET /trade-api/v2/markets` (list)
- `GET /trade-api/v2/markets/{ticker}` (detail)
- optional `GET /trade-api/v2/markets/{ticker}/orderbook` (quality enrichment)

## 5.2 Adapter contract
Create adapter interface:
```ts
interface PredictionMarketAdapter {
  listOpenMarkets(params?: { cursor?: string; limit?: number }): Promise<ExternalMarket[]>;
  getMarket(ticker: string): Promise<ExternalMarketDetail>;
}
```

Implement `KalshiAdapter` with normalization into internal shape:
- `ticker`, `eventTicker`, `title`, `status`
- `yesBid`, `yesAsk`, `lastPrice`, `volume`, `openInterest`, `liquidity`
- `capturedAt`, raw payload

## 5.3 Polling cadence
- default: every 10 minutes
- backoff on failures: exponential + jitter
- dedupe snapshots if no meaningful quote change in last N minutes (optional optimization)

## 6) Forecast materialization logic

## 6.1 Probability extraction
For each mapped market snapshot:
1. If `yes_bid` and `yes_ask` present -> `p = (bid + ask) / 2`
2. Else if `last_price` present -> `p = last_price`
3. Else -> unmapped/invalid for this run

Apply side/transform:
- `side='yes'`, `transform='direct'`: `p_effective = p`
- `side='no'` or `transform='inverse'`: `p_effective = 1 - p`

Clamp to `[0,1]`.

## 6.2 Quality score
Compute `q in [0,1]` from:
- spread quality (`1 - (ask-bid)` when both present)
- liquidity/open interest normalization
- freshness decay from `captured_at`

Initial simple formula:
```txt
q = 0.5*spread_component + 0.3*liquidity_component + 0.2*freshness_component
```

## 6.3 Aggregate into forecast table
For each `(episode_id, contestant_id, category)`:
- weighted probability: `p_hat = sum(p_effective * q) / sum(q)`
- expected value: `ev = p_hat * category_point_value`
- write to `contestant_opportunity_forecasts` with non-null `model_version` (ex: `kalshi-v1`)

Note: keep `model_version` required at write-time to avoid duplicate rows through NULL-unique behavior.

## 6.4 Category point value source
Add `lib/opportunity/categoryPointValues.ts`:
- map supported categories to point values from scoring config (or safe defaults)
- v1 supported:
  - `Survival`
  - `Individual immunity`
  - `Idol played`
  - `Advantage played`

## 7) Pricing blend design

## 7.1 Episode alignment
When computing prices for episode `ep` (post-episode reprice), use forecasts targeting `ep + 1`.

## 7.2 Ratios
Existing:
- `perfRatio` from realized weighted score.

New opportunity ratio:
- `opportunityScore_c = Σ(weight_cat * EV_cat)`
- `oppRatio = clamp((opportunityScore_c - avgOpportunityScore) / max(abs(avgOpportunityScore), eps), -1, 1)`

Blended:
- `blendedRatioRaw = (1 - alpha) * perfRatio + alpha * oppRatio`
- `blendedRatio = clamp(blendedRatioRaw, -1, 1)`

## 7.3 Guardrails
- `alpha` default `0.0` (shadow mode)
- `max_external_component_pct` default `0.01` (1% of prev price)
- if forecast coverage for active cast < threshold (ex: 40%), external component = 0

## 7.4 Audit additions
Store in `price_adjustment_audit`:
- `opportunity_score`, `field_avg_opportunity_score`, `opportunity_ratio`
- `blend_alpha`, `blended_ratio`, `external_component`
- `opportunity_contributions` (category -> weighted EV contribution)
- `forecast_model_version`

## 8) API design

### 8.1 Ingestion
- `POST /api/admin/markets/ingest/kalshi`
  - query/body: optional status, cursor, limit, dryRun
  - response: markets upserted, snapshots inserted, duration, errors

### 8.2 Mapping CRUD
- `GET /api/admin/market-mappings?episode=N`
- `POST /api/admin/market-mappings`
- `PATCH /api/admin/market-mappings/:id`
- `DELETE /api/admin/market-mappings/:id`

### 8.3 Forecast materialization
- `POST /api/admin/forecasts/materialize?episode=N&model=kalshi-v1`
- `GET /api/admin/forecasts?episode=N&model=kalshi-v1`

### 8.4 Config
Extend `price-adjustment-config`:
- `opportunity_alpha`
- `opportunity_enabled`
- `opportunity_min_coverage`
- `max_external_component_pct`

## 9) File-level implementation tasks

### 9.1 New files
- `app/lib/markets/types.ts`
- `app/lib/markets/kalshiClient.ts`
- `app/lib/markets/kalshiAdapter.ts`
- `app/lib/opportunity/categoryPointValues.ts`
- `app/lib/opportunity/materializeForecasts.ts`
- `app/app/api/admin/markets/ingest/kalshi/route.ts`
- `app/app/api/admin/market-mappings/route.ts`
- `app/app/api/admin/market-mappings/[id]/route.ts`
- `app/app/api/admin/forecasts/materialize/route.ts`
- `app/app/api/admin/forecasts/route.ts`
- migrations for tables above

### 9.2 Modify existing files
- `app/lib/materializePrices.ts`
  - load forecasts for `ep+1`
  - compute `oppRatio`
  - blend ratios with guardrails
  - persist new audit fields
- `app/app/api/admin/price-adjustment-config/route.ts`
  - include/read/write blend settings
- `app/app/admin/page.tsx`
  - add sections:
    - Market ingest action
    - Mapping CRUD table
    - Forecast preview table
    - Blend config controls

## 10) Rollout plan

### Phase 0: Schema + ingestion only
- Deploy migrations and Kalshi ingest route.
- Validate snapshots and market coverage.

### Phase 1: Mapping + forecast materialization
- Build admin mapping UI.
- Materialize forecasts into `contestant_opportunity_forecasts`.
- No price impact yet.

### Phase 2: Shadow pricing
- Compute blend fields and audit values.
- Keep `alpha=0` (no effective impact).
- Validate coverage and drift.

### Phase 3: Controlled enablement
- Enable with `alpha=0.1`, then `0.2`.
- Keep strict caps and monitor audit.

## 11) Testing plan

### Unit tests
- probability extraction (bid/ask midpoint fallback to last)
- side/transform correctness
- quality score bounds and monotonic behavior
- opp ratio and blend guardrail math

### Integration tests
- ingest route writes markets/snapshots
- mapping CRUD auth and validation
- forecast materialization writes one row per mapped tuple
- materialize pricing writes audit with external fields

### Manual checks
1. Ingest markets -> verify fresh snapshots.
2. Add mapping for one contestant/category.
3. Materialize forecasts for episode N.
4. Materialize prices with `alpha=0`: audit fields populate, prices unchanged vs baseline.
5. Set `alpha=0.1`: price shifts bounded by configured cap.

## 12) Open decisions to finalize before build
1. Minimum supported category set in v1 (recommended 4 categories listed above).
2. Whether mapping is strictly manual at launch or includes auto-suggest.
3. Target episode policy (`ep+1` recommended) for blend alignment.
4. Default blend caps (`alpha`, coverage threshold, external cap).

