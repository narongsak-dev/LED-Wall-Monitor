-- Tariff on/off toggle. Defaults to TRUE so existing rows keep working
-- (the cost cards keep showing). The frontend toggle lets the operator
-- turn the feature off without losing the configured rate.

ALTER TABLE "tariffs"
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT TRUE;
