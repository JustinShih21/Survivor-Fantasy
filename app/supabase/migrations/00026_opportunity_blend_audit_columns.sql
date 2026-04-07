ALTER TABLE price_adjustment_audit
  ADD COLUMN IF NOT EXISTS blend_alpha NUMERIC,
  ADD COLUMN IF NOT EXISTS opportunity_score NUMERIC,
  ADD COLUMN IF NOT EXISTS field_avg_opportunity_score NUMERIC,
  ADD COLUMN IF NOT EXISTS opportunity_ratio NUMERIC,
  ADD COLUMN IF NOT EXISTS blended_ratio NUMERIC,
  ADD COLUMN IF NOT EXISTS external_component NUMERIC,
  ADD COLUMN IF NOT EXISTS opportunity_contributions JSONB,
  ADD COLUMN IF NOT EXISTS forecast_model_version TEXT;

CREATE INDEX IF NOT EXISTS idx_price_adjustment_audit_episode_run_at
  ON price_adjustment_audit(episode_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_contestant_opportunity_forecasts_episode_model
  ON contestant_opportunity_forecasts(episode_id, model_version);
