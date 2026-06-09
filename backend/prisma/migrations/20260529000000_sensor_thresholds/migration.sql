-- Per-sensor alert thresholds. NULL means "use the global default."
-- These columns were added to schema.prisma earlier but never migrated.

ALTER TABLE "sensors"
  ADD COLUMN IF NOT EXISTS "voltage_min"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "voltage_max"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "current_max"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "power_max"       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "temperature_max" DOUBLE PRECISION;
