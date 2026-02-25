-- Add removed_at_episode for soft-delete: sold players keep their points
-- NULL = still on roster; set to episode when sold
ALTER TABLE tribe_entries ADD COLUMN IF NOT EXISTS removed_at_episode INTEGER;
