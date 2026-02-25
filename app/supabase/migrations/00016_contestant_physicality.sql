-- Add Physicality trait (1-100) to match the five traits: Physicality, Cognition, Strategy, Influence, Resilience.
ALTER TABLE contestants ADD COLUMN IF NOT EXISTS physicality INTEGER NOT NULL DEFAULT 50 CHECK (physicality >= 1 AND physicality <= 100);
