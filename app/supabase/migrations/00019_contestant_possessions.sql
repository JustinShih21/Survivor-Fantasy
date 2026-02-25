-- Idol, advantage, and clue counts per contestant (admin-editable; shown on pick-team cards).

CREATE TABLE contestant_possessions (
  contestant_id TEXT PRIMARY KEY REFERENCES contestants(id) ON DELETE CASCADE,
  idols INTEGER NOT NULL DEFAULT 0,
  advantages INTEGER NOT NULL DEFAULT 0,
  clues INTEGER NOT NULL DEFAULT 0
);

INSERT INTO contestant_possessions (contestant_id, idols, advantages, clues)
SELECT id, 0, 0, 0 FROM contestants
ON CONFLICT (contestant_id) DO NOTHING;

ALTER TABLE contestant_possessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read contestant_possessions" ON contestant_possessions
  FOR SELECT TO authenticated USING (true);

-- Writes via admin API (service role only)
