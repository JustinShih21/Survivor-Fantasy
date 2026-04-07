CREATE TABLE contestant_opportunity_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id INTEGER NOT NULL,
  contestant_id TEXT NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  probability NUMERIC,
  expected_value NUMERIC,
  model_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (episode_id, contestant_id, category, model_version)
);

CREATE INDEX idx_contestant_opportunity_forecasts_episode
  ON contestant_opportunity_forecasts(episode_id);
CREATE INDEX idx_contestant_opportunity_forecasts_contestant
  ON contestant_opportunity_forecasts(contestant_id);

ALTER TABLE contestant_opportunity_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read forecasts" ON contestant_opportunity_forecasts
  FOR SELECT USING (auth.role() = 'authenticated');
