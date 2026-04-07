CREATE TABLE IF NOT EXISTS kalshi_markets (
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

CREATE TABLE IF NOT EXISTS kalshi_market_snapshots (
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

CREATE INDEX IF NOT EXISTS idx_kalshi_market_snapshots_ticker_time
  ON kalshi_market_snapshots(ticker, captured_at DESC);

CREATE TABLE IF NOT EXISTS contestant_market_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('kalshi')),
  market_ticker TEXT NOT NULL REFERENCES kalshi_markets(ticker) ON DELETE CASCADE,
  episode_id INTEGER NOT NULL,
  contestant_id TEXT NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  side TEXT NOT NULL DEFAULT 'yes' CHECK (side IN ('yes', 'no')),
  transform TEXT NOT NULL DEFAULT 'direct' CHECK (transform IN ('direct', 'inverse')),
  confidence NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, market_ticker, episode_id, contestant_id, category)
);

CREATE INDEX IF NOT EXISTS idx_contestant_market_mappings_episode
  ON contestant_market_mappings(episode_id, contestant_id);

CREATE TABLE IF NOT EXISTS opportunity_forecast_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_episode_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model_version TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'completed',
  summary JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE kalshi_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kalshi_market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE contestant_market_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_forecast_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read kalshi_markets" ON kalshi_markets;
CREATE POLICY "Authenticated can read kalshi_markets" ON kalshi_markets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read kalshi_market_snapshots" ON kalshi_market_snapshots;
CREATE POLICY "Authenticated can read kalshi_market_snapshots" ON kalshi_market_snapshots
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read contestant_market_mappings" ON contestant_market_mappings;
CREATE POLICY "Authenticated can read contestant_market_mappings" ON contestant_market_mappings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read opportunity_forecast_runs" ON opportunity_forecast_runs;
CREATE POLICY "Authenticated can read opportunity_forecast_runs" ON opportunity_forecast_runs
  FOR SELECT TO authenticated USING (true);
