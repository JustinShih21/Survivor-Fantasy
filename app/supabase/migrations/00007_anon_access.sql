-- Allow anon key to read/write demo tables (no auth prototype)
-- Run this if tribe creation fails silently due to RLS blocking inserts

-- Enable RLS and add permissive policy for tribe_entries (demo uses anon key)
ALTER TABLE tribe_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all tribe_entries" ON tribe_entries;
CREATE POLICY "Allow anon all tribe_entries" ON tribe_entries
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Same for other demo tables
ALTER TABLE captain_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all captain_picks" ON captain_picks;
CREATE POLICY "Allow anon all captain_picks" ON captain_picks
  FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE contestants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read contestants" ON contestants;
CREATE POLICY "Allow anon read contestants" ON contestants
  FOR SELECT TO anon USING (true);

ALTER TABLE episode_outcomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read episode_outcomes" ON episode_outcomes;
CREATE POLICY "Allow anon read episode_outcomes" ON episode_outcomes
  FOR SELECT TO anon USING (true);

ALTER TABLE scoring_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read scoring_config" ON scoring_config;
CREATE POLICY "Allow anon read scoring_config" ON scoring_config
  FOR SELECT TO anon USING (true);

ALTER TABLE season_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon all season_state" ON season_state;
CREATE POLICY "Allow anon all season_state" ON season_state
  FOR ALL TO anon USING (true) WITH CHECK (true);
