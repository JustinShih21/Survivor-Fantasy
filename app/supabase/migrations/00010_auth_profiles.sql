-- Profiles table: linked 1:1 with auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  tribe_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_tribe_name ON profiles(lower(tribe_name));

-- RLS for profiles: anyone authenticated can read (for leaderboards), only own row for write
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Update tribe_entries RLS: replace anon-open policy with auth-scoped
DROP POLICY IF EXISTS "Allow anon all tribe_entries" ON tribe_entries;

DROP POLICY IF EXISTS "Users can view own tribe_entries" ON tribe_entries;
CREATE POLICY "Users can view own tribe_entries" ON tribe_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tribe_entries" ON tribe_entries;
CREATE POLICY "Users can insert own tribe_entries" ON tribe_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tribe_entries" ON tribe_entries;
CREATE POLICY "Users can update own tribe_entries" ON tribe_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tribe_entries" ON tribe_entries;
CREATE POLICY "Users can delete own tribe_entries" ON tribe_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Update captain_picks RLS: replace anon-open policy with auth-scoped
DROP POLICY IF EXISTS "Allow anon all captain_picks" ON captain_picks;

DROP POLICY IF EXISTS "Users can view own captain_picks" ON captain_picks;
CREATE POLICY "Users can view own captain_picks" ON captain_picks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own captain_picks" ON captain_picks;
CREATE POLICY "Users can insert own captain_picks" ON captain_picks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own captain_picks" ON captain_picks;
CREATE POLICY "Users can update own captain_picks" ON captain_picks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own captain_picks" ON captain_picks;
CREATE POLICY "Users can delete own captain_picks" ON captain_picks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Read-only tables: allow authenticated users to read
DROP POLICY IF EXISTS "Allow anon read contestants" ON contestants;
DROP POLICY IF EXISTS "Authenticated can read contestants" ON contestants;
CREATE POLICY "Authenticated can read contestants" ON contestants
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon read episode_outcomes" ON episode_outcomes;
DROP POLICY IF EXISTS "Authenticated can read episode_outcomes" ON episode_outcomes;
CREATE POLICY "Authenticated can read episode_outcomes" ON episode_outcomes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon read scoring_config" ON scoring_config;
DROP POLICY IF EXISTS "Authenticated can read scoring_config" ON scoring_config;
CREATE POLICY "Authenticated can read scoring_config" ON scoring_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon all season_state" ON season_state;
DROP POLICY IF EXISTS "Authenticated can read season_state" ON season_state;
CREATE POLICY "Authenticated can read season_state" ON season_state
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can update season_state" ON season_state;
CREATE POLICY "Authenticated can update season_state" ON season_state
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
