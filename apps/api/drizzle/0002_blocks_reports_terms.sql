-- iOS launch: moderation (blocks + reports) and EULA acceptance.
-- Hand-written like 0001: drizzle-kit's db:generate wants an interactive TTY
-- to resolve column conflicts on this introspected schema and cannot be run
-- from scripts/CI. Any future schema change should follow this precedent.

CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED');--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp(3);--> statement-breakpoint

CREATE TABLE "blocks" (
  "id" uuid PRIMARY KEY NOT NULL,
  "blocker_id" uuid NOT NULL,
  "blocked_id" uuid NOT NULL,
  "created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint

CREATE TABLE "reports" (
  "id" uuid PRIMARY KEY NOT NULL,
  "reporter_id" uuid,
  "reported_user_id" uuid,
  "reason" varchar(64) NOT NULL,
  "details" text,
  "status" "ReportStatus" DEFAULT 'PENDING' NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamp(3),
  "created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "blocks_pair_key" ON "blocks" USING btree ("blocker_id" uuid_ops, "blocked_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "blocks_blocker_idx" ON "blocks" USING btree ("blocker_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "blocks" USING btree ("blocked_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "reports_created_at_idx" ON "reports" USING btree ("created_at" timestamp_ops);--> statement-breakpoint

ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_fkey"
  FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON UPDATE cascade ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_fkey"
  FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON UPDATE cascade ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey"
  FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON UPDATE cascade ON DELETE set null;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_fkey"
  FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON UPDATE cascade ON DELETE set null;
