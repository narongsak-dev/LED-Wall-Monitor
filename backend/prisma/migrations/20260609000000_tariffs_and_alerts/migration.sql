-- ────────────────────────────────────────────────────────────────
--  Phase 3: Tariffs + Alerts
--  - tariffs: one flat THB/kWh rate per site (extendable to TOU later)
--  - alerts:  records produced by the rules engine, supports ack + auto-resolve
-- ────────────────────────────────────────────────────────────────

CREATE TABLE "tariffs" (
    "id"         BIGSERIAL              PRIMARY KEY,
    "site_id"    BIGINT                 NOT NULL,
    "rate"       DOUBLE PRECISION       NOT NULL,
    "currency"   VARCHAR(8)             NOT NULL DEFAULT 'THB',
    "name"       VARCHAR(100),
    "created_at" TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ            NOT NULL,

    CONSTRAINT "tariffs_site_id_unique"   UNIQUE      ("site_id"),
    CONSTRAINT "tariffs_site_id_fkey"     FOREIGN KEY ("site_id")
        REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

CREATE TABLE "alerts" (
    "id"                BIGSERIAL              PRIMARY KEY,
    "site_id"           BIGINT                 NOT NULL,
    "zone_id"           BIGINT,
    "board_id"          BIGINT,
    "sensor_id"         BIGINT,
    "severity"          "AlertSeverity"        NOT NULL,
    "code"              VARCHAR(50)            NOT NULL,
    "message"           VARCHAR(500)           NOT NULL,
    "created_at"        TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at"       TIMESTAMPTZ,
    "acknowledged_at"   TIMESTAMPTZ,
    "acknowledged_by"   BIGINT,

    CONSTRAINT "alerts_site_id_fkey" FOREIGN KEY ("site_id")
        REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by")
        REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,

    -- NULLs collapse to distinct in Postgres, so this both prevents
    -- duplicate open alerts AND allows multiple historic resolutions.
    CONSTRAINT "alerts_dedup" UNIQUE ("site_id", "board_id", "sensor_id", "code", "resolved_at")
);

CREATE INDEX "alerts_site_created_idx" ON "alerts" ("site_id", "created_at" DESC);
CREATE INDEX "alerts_site_resolved_idx" ON "alerts" ("site_id", "resolved_at");
