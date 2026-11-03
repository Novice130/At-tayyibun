-- Push notifications for the mobile app: one row per FCM registration token.
-- Hand-written and idempotent (safe to re-run), like 0001-0006.
--
-- Numbered 0008 because 0007 is reserved for a photo migration that is not
-- merged yet. The migrator applies entries in journal order and skips any
-- whose `when` is not newer than the last one applied, so whatever lands as
-- 0007 later must be appended after this entry with a larger `when` (or be
-- renumbered 0009).

CREATE TABLE IF NOT EXISTS "device_tokens" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "token" text NOT NULL,
  "platform" varchar(16) NOT NULL,
  "created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "device_tokens_platform_check" CHECK ("platform" IN ('android', 'ios'))
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "device_tokens_token_key" ON "device_tokens" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_tokens_user_id_idx" ON "device_tokens" USING btree ("user_id" uuid_ops);--> statement-breakpoint

-- Deleting a user (self-serve or admin) removes their tokens with them.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_tokens_user_id_fkey') THEN
    ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE cascade ON DELETE cascade;
  END IF;
END
$$;
