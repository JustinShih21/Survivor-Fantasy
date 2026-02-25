-- Leagues system: leagues, members, email invites

-- Leagues table
CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_leagues_created_by ON leagues(created_by);
CREATE INDEX idx_leagues_invite_code ON leagues(invite_code);

-- League members (many-to-many: users <-> leagues)
CREATE TABLE league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(league_id, user_id)
);

CREATE INDEX idx_league_members_user ON league_members(user_id);
CREATE INDEX idx_league_members_league ON league_members(league_id);

-- League email invites
CREATE TABLE league_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_league_invites_league ON league_invites(league_id);

-- =====================
-- RLS: leagues
-- =====================
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all leagues" ON leagues
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create leagues" ON leagues
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- =====================
-- RLS: league_members
-- =====================
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read league members for their leagues" ON league_members
  FOR SELECT TO authenticated USING (
    league_id IN (SELECT lm.league_id FROM league_members lm WHERE lm.user_id = auth.uid())
  );

CREATE POLICY "Authenticated can join leagues" ON league_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- =====================
-- RLS: league_invites
-- =====================
ALTER TABLE league_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "League members can read invites for their leagues" ON league_invites
  FOR SELECT TO authenticated USING (
    league_id IN (SELECT lm.league_id FROM league_members lm WHERE lm.user_id = auth.uid())
  );

CREATE POLICY "League members can create invites" ON league_invites
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = invited_by
    AND league_id IN (SELECT lm.league_id FROM league_members lm WHERE lm.user_id = auth.uid())
  );

-- =====================
-- Broaden tribe_entries & captain_picks for leaderboard/standings
-- =====================

-- Allow all authenticated users to read all tribe_entries (needed for league standings & global leaderboard)
DROP POLICY IF EXISTS "Users can view own tribe_entries" ON tribe_entries;
CREATE POLICY "Authenticated can read all tribe_entries" ON tribe_entries
  FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to read all captain_picks (needed for league member breakdowns)
DROP POLICY IF EXISTS "Users can view own captain_picks" ON captain_picks;
CREATE POLICY "Authenticated can read all captain_picks" ON captain_picks
  FOR SELECT TO authenticated USING (true);
