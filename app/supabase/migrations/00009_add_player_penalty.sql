-- Update add_player_penalty to -10 per PRD (transfer add penalty)
UPDATE scoring_config
SET config = jsonb_set(config, '{other,add_player_penalty}', '-10')
WHERE id = 'default';
