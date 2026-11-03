-- Contact details now reach a requester through a link tied to their login,
-- and admin suspension becomes a real state. Hand-written and idempotent (safe
-- to re-run), like 0001-0005.

ALTER TABLE "info_requests" ADD COLUMN IF NOT EXISTS "share_source" text;--> statement-breakpoint
ALTER TABLE "info_requests" ADD COLUMN IF NOT EXISTS "contact_expires_at" timestamp(3);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp(3);--> statement-breakpoint

-- The one-time token was never delivered to anyone but was returned by the
-- request lists. Nothing reads it any more; the column goes in a later release
-- so a rollback to the previous image still works.
UPDATE "info_requests" SET "one_time_token" = NULL WHERE "one_time_token" IS NOT NULL;--> statement-breakpoint

-- Under-18 dates include the today's-date placeholder written when a profile
-- is first saved without a date of birth. Those profiles were never eligible.
UPDATE "profiles" SET "profile_complete" = false
WHERE "profile_complete" = true AND "dob" > (CURRENT_DATE - INTERVAL '18 years');
