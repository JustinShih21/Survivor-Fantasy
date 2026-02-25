-- Survivor Fantasy Prototype Schema
-- Demo user: 00000000-0000-0000-0000-000000000001 (no auth)

-- Contestants: 24 contestants with prices
CREATE TABLE contestants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starting_tribe TEXT NOT NULL,
  pre_merge_price INTEGER NOT NULL,
  photo_url TEXT
);

-- Episode outcomes: full JSONB per episode (from scenario generator)
CREATE TABLE episode_outcomes (
  episode_id INTEGER PRIMARY KEY,
  phase TEXT NOT NULL,
  outcome JSONB NOT NULL
);

-- Scoring config: single row with full scoring.yaml as JSONB
CREATE TABLE scoring_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config JSONB NOT NULL
);

-- Tribe entries: user's roster (contestant picks)
CREATE TABLE tribe_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contestant_id TEXT NOT NULL REFERENCES contestants(id),
  phase TEXT NOT NULL DEFAULT 'pre_merge',
  is_wild_card BOOLEAN NOT NULL DEFAULT false,
  added_at_episode INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, contestant_id, phase)
);

-- Captain picks: per episode
CREATE TABLE captain_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  episode_id INTEGER NOT NULL,
  contestant_id TEXT NOT NULL REFERENCES contestants(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, episode_id)
);

-- Season state: current episode for prototype
CREATE TABLE season_state (
  id TEXT PRIMARY KEY DEFAULT 'current',
  current_episode INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO season_state (id, current_episode) VALUES ('current', 1);

-- Indexes for common queries
CREATE INDEX idx_tribe_entries_user ON tribe_entries(user_id);
CREATE INDEX idx_captain_picks_user ON captain_picks(user_id);
