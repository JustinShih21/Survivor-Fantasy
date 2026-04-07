CREATE TABLE price_adjustment_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  episode_id INTEGER NOT NULL,
  contestant_id TEXT NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  adjustment_rate NUMERIC NOT NULL,
  weights_snapshot JSONB NOT NULL,
  prev_price INTEGER NOT NULL,
  new_price INTEGER NOT NULL,
  price_change INTEGER NOT NULL,
  weighted_score NUMERIC NOT NULL,
  field_avg_weighted_score NUMERIC NOT NULL,
  perf_ratio NUMERIC NOT NULL,
  category_contributions JSONB NOT NULL
);

CREATE INDEX idx_price_adjustment_audit_episode ON price_adjustment_audit(episode_id);
CREATE INDEX idx_price_adjustment_audit_run_at ON price_adjustment_audit(run_at DESC);

ALTER TABLE price_adjustment_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read price audit" ON price_adjustment_audit
  FOR SELECT USING (auth.role() = 'authenticated');
