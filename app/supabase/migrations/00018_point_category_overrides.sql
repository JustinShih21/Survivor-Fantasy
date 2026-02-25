-- Category-based point overrides: (contestant_id, episode_id, category) -> points.
-- category must match breakdown labels (e.g. Survival, Team immunity (1st), Episode rank bonus).

CREATE TABLE point_category_overrides (
  contestant_id TEXT NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  episode_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  points INTEGER NOT NULL,
  PRIMARY KEY (contestant_id, episode_id, category)
);

CREATE INDEX idx_point_category_overrides_episode ON point_category_overrides(episode_id);

ALTER TABLE point_category_overrides ENABLE ROW LEVEL SECURITY;

-- Authenticated can read (scores API applies overrides)
CREATE POLICY "Authenticated can read point_category_overrides" ON point_category_overrides
  FOR SELECT TO authenticated USING (true);

-- Writes via admin API (service role only)
