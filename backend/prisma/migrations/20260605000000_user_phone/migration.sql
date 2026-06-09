-- Add an optional phone number column to users — used by the profile
-- self-service form and contact lookups.
ALTER TABLE "users" ADD COLUMN "phone_number" VARCHAR(30);
