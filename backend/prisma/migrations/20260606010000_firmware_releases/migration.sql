CREATE TABLE "firmware_releases" (
    "id"          BIGSERIAL    PRIMARY KEY,
    "version"     VARCHAR(40)  NOT NULL,
    "description" TEXT,
    "filename"    VARCHAR(200) NOT NULL,
    "file_size"   INTEGER      NOT NULL,
    "sha256"      VARCHAR(64)  NOT NULL,
    "is_active"   BOOLEAN      NOT NULL DEFAULT TRUE,
    "uploaded_by" BIGINT,
    "uploaded_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "firmware_releases_version_key"
    ON "firmware_releases" ("version");

CREATE INDEX "firmware_releases_is_active_uploaded_at_idx"
    ON "firmware_releases" ("is_active", "uploaded_at" DESC);
