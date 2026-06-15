-- Add `phases` column to sensors. NULL = N/A (PZEM or unknown), 1 =
-- single-phase, 3 = three-phase. Backfilled to NULL for every existing
-- row — the admin UI's sensor edit form picks it up from there.
ALTER TABLE "sensors"
  ADD COLUMN "phases" SMALLINT;
