-- Fix: allow users to read their own league_members rows so "Your Leagues" list populates.
-- The existing policy uses a self-referential subquery that can hide rows; this ensures
-- authenticated users always see their own memberships.
CREATE POLICY "Users can read own league memberships" ON league_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());
