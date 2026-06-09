-- Forgot-password approval chain
CREATE TYPE "PasswordResetStatus" AS ENUM ('pending', 'approved', 'rejected', 'used', 'expired');

CREATE TABLE "password_reset_requests" (
    "id"               BIGSERIAL                  PRIMARY KEY,
    "user_id"          BIGINT                     NOT NULL,
    "requested_at"     TIMESTAMPTZ NOT NULL       DEFAULT NOW(),
    "status"           "PasswordResetStatus"      NOT NULL DEFAULT 'pending',
    "provided_contact" VARCHAR(120)               NOT NULL,
    "ip_address"       VARCHAR(45),
    "user_agent"       TEXT,
    "approver_id"      BIGINT,
    "approved_at"      TIMESTAMPTZ,
    "code_hash"        VARCHAR(255),
    "code_expires_at"  TIMESTAMPTZ,
    "rejected_reason"  VARCHAR(500),
    "used_at"          TIMESTAMPTZ,

    CONSTRAINT "password_reset_requests_user_id_fkey"
      FOREIGN KEY ("user_id")     REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "password_reset_requests_approver_id_fkey"
      FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "password_reset_requests_user_id_requested_at_idx"
    ON "password_reset_requests" ("user_id", "requested_at" DESC);

CREATE INDEX "password_reset_requests_status_requested_at_idx"
    ON "password_reset_requests" ("status", "requested_at" DESC);
