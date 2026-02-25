-- Backfill episode_outcomes with new BPS fields (vote_targets, votes_received, confessional_counts, etc.)
-- Uses same data as 00002; for DBs that ran 00002 before this migration, run the episode_outcomes
-- section from 00002_seed_data.sql in Supabase SQL Editor, or re-run export_seed_data.py and
-- apply the generated migration.

-- Update scoring config with new BPS-compatible values
UPDATE scoring_config
SET config = '{
  "survival": {"pre_merge_no_tribal": 0, "pre_merge_tribal": 1, "post_merge": 3},
  "placement": {"final_tribal": 6, "win_season": 10},
  "team_immunity": {"first": 2, "second_three_team": 1, "second_two_team": 1, "last_or_second_two_team": -1},
  "team_reward": {"first": 1, "second_three_team": 0, "second_two_team": 0, "last": 0},
  "tribal": {"vote_matched": 2, "correct_target_vote": 1, "zero_votes_received": 1, "voted_out_base": -4, "voted_out_per_vote": -2, "voted_out_pocket_multiplier": 2},
  "individual_immunity": 6,
  "confessionals": {"range_4_6": 2, "range_7_plus": 4},
  "advantages": {"clue_read": 2, "advantage_play": 5, "idol_play_per_vote": 2, "idol_failure": -2, "strategic_player": 5},
  "other": {"quit": -10, "medevac": 0, "add_player_penalty": -5},
  "captain_multiplier": 2
}'::jsonb
WHERE id = 'default';
