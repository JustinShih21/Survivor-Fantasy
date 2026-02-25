-- Point overrides: admin can set manual points per contestant per episode.
-- When present, override replaces computed points for that (contestant_id, episode_id).

CREATE TABLE point_overrides (
  contestant_id TEXT NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  episode_id INTEGER NOT NULL,
  points INTEGER NOT NULL,
  PRIMARY KEY (contestant_id, episode_id)
);

CREATE INDEX idx_point_overrides_episode ON point_overrides(episode_id);

ALTER TABLE point_overrides ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (scores API needs to apply overrides)
CREATE POLICY "Authenticated can read point_overrides" ON point_overrides
  FOR SELECT TO authenticated USING (true);

-- No INSERT/UPDATE/DELETE for anon or authenticated; admin API uses service role
