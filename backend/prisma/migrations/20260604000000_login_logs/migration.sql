-- Login audit trail: records every login attempt (success or failure) so the
-- "ประวัติการเข้าใช้งานระบบ" page can show who logged in, when, from where.
--
-- user_id is nullable + ON DELETE SET NULL so a deleted user's history (and
-- failed attempts with an unknown username) are still retained.

CREATE TABLE "login_logs" (
    "id"          BIGSERIAL    NOT NULL,
    "user_id"     BIGINT,
    "username"    VARCHAR(50)  NOT NULL,
    "success"     BOOLEAN      NOT NULL DEFAULT true,
    "ip_address"  VARCHAR(45),
    "user_agent"  TEXT,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_logs_pkey"         PRIMARY KEY ("id"),
    CONSTRAINT "login_logs_user_id_fkey" FOREIGN KEY ("user_id")
                                         REFERENCES  "users"("id") ON DELETE SET NULL
);

CREATE INDEX "login_logs_user_id_created_at_idx" ON "login_logs"("user_id", "created_at" DESC);
CREATE INDEX "login_logs_created_at_idx"         ON "login_logs"("created_at" DESC);
