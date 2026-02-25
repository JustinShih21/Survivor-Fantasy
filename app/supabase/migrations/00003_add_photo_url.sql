-- Add photo_url column to contestants (for existing DBs after 00002 ran without it)
ALTER TABLE contestants ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Backfill existing rows with DiceBear avatars
UPDATE contestants
SET photo_url = 'https://api.dicebear.com/7.x/avataaars/png?seed=' || id || '&size=80'
WHERE photo_url IS NULL OR photo_url = '';
