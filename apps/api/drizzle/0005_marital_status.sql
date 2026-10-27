-- Marital status, children and "open to" matching preferences on profiles.
-- Hand-written and idempotent (safe to re-run), like 0001-0004. The enum has
-- no "married" value on purpose: married people are not eligible members.

DO $$ BEGIN
	CREATE TYPE "public"."MaritalStatus" AS ENUM('NEVER_MARRIED','DIVORCED','WIDOWED');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "marital_status" "MaritalStatus";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "has_children" boolean;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "children_count" smallint;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "open_to_divorced" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "open_to_widowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "open_to_children" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Pre-launch: existing members must answer the new questions before they
-- reappear in browse (spec, Existing members). Only touches rows that have
-- not answered yet, so re-running does not undo completed profiles.
UPDATE "profiles" SET "profile_complete" = false WHERE "marital_status" IS NULL;
