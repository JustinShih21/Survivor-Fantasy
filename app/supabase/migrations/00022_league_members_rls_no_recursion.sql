-- Fix infinite recursion: policies on league_members must not SELECT from league_members under RLS.
-- Use a SECURITY DEFINER function so "my league ids" is resolved without triggering RLS.

-- Remove the policy that causes infinite recursion (subquery on league_members).
DROP POLICY IF EXISTS "Members can read league members for their leagues" ON league_members;

-- Function so we can allow "read rows for leagues I'm in" without querying league_members under RLS.
CREATE OR REPLACE FUNCTION public.get_my_league_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT league_id FROM league_members WHERE user_id = auth.uid();
$$;

-- Allow users to read all league_members rows for leagues they belong to (for standings/member counts).
CREATE POLICY "Users can read members of their leagues" ON league_members
  FOR SELECT TO authenticated
  USING (league_id IN (SELECT get_my_league_ids()));

-- league_invites policies also use the recursive subquery; switch them to the helper.
DROP POLICY IF EXISTS "League members can read invites for their leagues" ON league_invites;
CREATE POLICY "League members can read invites for their leagues" ON league_invites
  FOR SELECT TO authenticated
  USING (league_id IN (SELECT get_my_league_ids()));

DROP POLICY IF EXISTS "League members can create invites" ON league_invites;
CREATE POLICY "League members can create invites" ON league_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = invited_by
    AND league_id IN (SELECT get_my_league_ids())
  );
