-- Trait scores per contestant: Cognition, Strategy, Influence, Resilience (1-100).
-- Admin can edit at any time; displayed wherever contestant data is shown.
-- IF NOT EXISTS makes this migration safe to re-run.

ALTER TABLE contestants ADD COLUMN IF NOT EXISTS cognition INTEGER NOT NULL DEFAULT 50 CHECK (cognition >= 1 AND cognition <= 100);
ALTER TABLE contestants ADD COLUMN IF NOT EXISTS strategy INTEGER NOT NULL DEFAULT 50 CHECK (strategy >= 1 AND strategy <= 100);
ALTER TABLE contestants ADD COLUMN IF NOT EXISTS influence INTEGER NOT NULL DEFAULT 50 CHECK (influence >= 1 AND influence <= 100);
ALTER TABLE contestants ADD COLUMN IF NOT EXISTS resilience INTEGER NOT NULL DEFAULT 50 CHECK (resilience >= 1 AND resilience <= 100);
