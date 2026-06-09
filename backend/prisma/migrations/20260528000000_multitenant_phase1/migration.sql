-- Phase 1 migration: multi-tenant cloud readiness.
--
-- Changes:
--   1. Rename UserRole enum values: admin → super_admin, user → viewer.
--      (viewer stays as viewer.) New value site_admin added.
--   2. New `groups` table — super_admin can cluster sites by region/customer.
--   3. `sites` gets nullable group_id.
--   4. New `zones` table — physical sub-area inside a site.
--   5. `boards` gets nullable zone_id.

-- ─── 1. UserRole enum migration ─────────────────────────────────────
-- Postgres won't let us rename existing enum values directly. We create a
-- new type, USING-cast the column to map old → new, then drop the old type.

CREATE TYPE "UserRole_new" AS ENUM ('super_admin', 'site_admin', 'viewer');

ALTER TABLE "users"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole_new" USING (
    CASE "role"::text
      WHEN 'admin'  THEN 'super_admin'::"UserRole_new"
      WHEN 'user'   THEN 'viewer'::"UserRole_new"
      WHEN 'viewer' THEN 'viewer'::"UserRole_new"
    END
  ),
  ALTER COLUMN "role" SET DEFAULT 'viewer'::"UserRole_new";

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- ─── 2. groups table ────────────────────────────────────────────────
CREATE TABLE "groups" (
    "id"          BIGSERIAL    NOT NULL,
    "code"        VARCHAR(50)  NOT NULL,
    "name"        VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "groups_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "groups_code_key"    UNIQUE      ("code")
);

-- ─── 3. sites.group_id ──────────────────────────────────────────────
ALTER TABLE "sites" ADD COLUMN "group_id" BIGINT;
ALTER TABLE "sites" ADD CONSTRAINT "sites_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL;
CREATE INDEX "sites_group_id_idx" ON "sites"("group_id");

-- ─── 4. zones table ─────────────────────────────────────────────────
CREATE TABLE "zones" (
    "id"          BIGSERIAL    NOT NULL,
    "site_id"     BIGINT       NOT NULL,
    "code"        VARCHAR(50)  NOT NULL,
    "name"        VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "zones_pkey"              PRIMARY KEY ("id"),
    CONSTRAINT "zones_site_id_code_key"  UNIQUE      ("site_id", "code"),
    CONSTRAINT "zones_site_id_fkey"      FOREIGN KEY ("site_id")
                                         REFERENCES  "sites"("id") ON DELETE CASCADE
);
CREATE INDEX "zones_site_id_idx" ON "zones"("site_id");

-- ─── 5. boards.zone_id ──────────────────────────────────────────────
ALTER TABLE "boards" ADD COLUMN "zone_id" BIGINT;
ALTER TABLE "boards" ADD CONSTRAINT "boards_zone_id_fkey"
  FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL;
CREATE INDEX "boards_zone_id_idx" ON "boards"("zone_id");
