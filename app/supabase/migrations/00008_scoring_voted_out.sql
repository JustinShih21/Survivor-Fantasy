-- Change voted out scoring: -1 per vote only (no base penalty)
UPDATE scoring_config
SET config = jsonb_set(
  jsonb_set(config, '{tribal,voted_out_base}', '0'),
  '{tribal,voted_out_per_vote}',
  '-1'
)
WHERE id = 'default';
