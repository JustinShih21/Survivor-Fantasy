-- Canonical stored prices per episode (materialized from formula).
-- Single source for "price at episode N"; all price reads use this table.
CREATE TABLE contestant_episode_prices (
  episode_id INTEGER NOT NULL,
  contestant_id TEXT NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  price_change INTEGER,
  PRIMARY KEY (episode_id, contestant_id)
);

CREATE INDEX idx_contestant_episode_prices_episode ON contestant_episode_prices(episode_id);
CREATE INDEX idx_contestant_episode_prices_contestant ON contestant_episode_prices(contestant_id);

ALTER TABLE contestant_episode_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read contestant_episode_prices" ON contestant_episode_prices
  FOR SELECT TO authenticated USING (true);

-- Writes via materialization (service role only)


-- Canonical stored points per episode per contestant (materialized from point_category_overrides).
-- Single source for "points for contestant in episode N"; all point reads use this table.
CREATE TABLE contestant_episode_points (
  episode_id INTEGER NOT NULL,
  contestant_id TEXT NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL,
  breakdown JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (episode_id, contestant_id)
);

CREATE INDEX idx_contestant_episode_points_episode ON contestant_episode_points(episode_id);
CREATE INDEX idx_contestant_episode_points_contestant ON contestant_episode_points(contestant_id);

ALTER TABLE contestant_episode_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read contestant_episode_points" ON contestant_episode_points
  FOR SELECT TO authenticated USING (true);

-- Writes via materialization (service role only)
