-- Pre-season launch: clear gameplay data so DB represents untouched preseason state.
-- Contestants, schema, and game structure remain; no episode outcomes.

DELETE FROM episode_outcomes;

UPDATE season_state
SET current_episode = 0
WHERE id = 'current';
