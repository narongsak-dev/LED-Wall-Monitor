-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'user', 'viewer');

-- CreateEnum
CREATE TYPE "SitePermission" AS ENUM ('read', 'write', 'admin');

-- CreateEnum
CREATE TYPE "SensorType" AS ENUM ('power_meter', 'temperature', 'humidity', 'gateway', 'other');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(120),
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(120),
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "location" VARCHAR(255),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Bangkok',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sites" (
    "user_id" BIGINT NOT NULL,
    "site_id" BIGINT NOT NULL,
    "permission" "SitePermission" NOT NULL DEFAULT 'read',

    CONSTRAINT "user_sites_pkey" PRIMARY KEY ("user_id","site_id")
);

-- CreateTable
CREATE TABLE "boards" (
    "id" BIGSERIAL NOT NULL,
    "site_id" BIGINT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200),
    "hardware" VARCHAR(100),
    "firmware" VARCHAR(50),
    "mac_address" VARCHAR(20),
    "ip_address" VARCHAR(45),
    "last_seen_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensors" (
    "id" BIGSERIAL NOT NULL,
    "board_id" BIGINT NOT NULL,
    "site_id" BIGINT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200),
    "sensor_type" "SensorType" NOT NULL DEFAULT 'power_meter',
    "model" VARCHAR(100),
    "channel" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry" (
    "time" TIMESTAMPTZ NOT NULL,
    "sensor_id" BIGINT NOT NULL,
    "board_id" BIGINT NOT NULL,
    "site_id" BIGINT NOT NULL,
    "voltage" DOUBLE PRECISION,
    "current" DOUBLE PRECISION,
    "power" DOUBLE PRECISION,
    "energy" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "raw" JSONB,

    CONSTRAINT "telemetry_pkey" PRIMARY KEY ("sensor_id","time")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");

-- CreateIndex
CREATE UNIQUE INDEX "boards_code_key" ON "boards"("code");

-- CreateIndex
CREATE UNIQUE INDEX "boards_mac_address_key" ON "boards"("mac_address");

-- CreateIndex
CREATE INDEX "boards_site_id_idx" ON "boards"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "sensors_code_key" ON "sensors"("code");

-- CreateIndex
CREATE INDEX "sensors_board_id_idx" ON "sensors"("board_id");

-- CreateIndex
CREATE INDEX "sensors_site_id_idx" ON "sensors"("site_id");

-- CreateIndex
CREATE INDEX "telemetry_site_id_time_idx" ON "telemetry"("site_id", "time" DESC);

-- CreateIndex
CREATE INDEX "telemetry_board_id_time_idx" ON "telemetry"("board_id", "time" DESC);

-- AddForeignKey
ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
