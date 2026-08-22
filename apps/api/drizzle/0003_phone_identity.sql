-- Firebase phone authentication: make the phone number a verified, globally
-- unique identity so one number backs exactly one account.
--
-- Hand-written like 0001 and 0002: drizzle-kit's db:generate wants an
-- interactive TTY to resolve column conflicts on this introspected schema, and
-- it cannot express a partial unique index from the schema DSL anyway.

-- Phone-first signups have no email at account-creation time, but better-auth's
-- core user model requires one, so the phone-number plugin mints a temporary
-- address (+92300...@phone.attayyibun.invalid). This flag marks those rows so
-- the app can (a) force a real address before letting the user in and (b) never
-- hand a placeholder to another human or to a bulk sender.
ALTER TABLE "users" ADD COLUMN "email_is_placeholder" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Accounts that predate phone verification are exempt from the phone gate, so
-- nobody who already signed up gets interrupted. This is deliberately a
-- SEPARATE flag from is_phone_verified: those rows carry self-asserted,
-- never-verified numbers, and marking them "verified" would let whoever really
-- owns such a number sign straight into the legacy account (the plugin looks a
-- user up by the phone column). Exempt from the gate, still unverified.
ALTER TABLE "users" ADD COLUMN "phone_gate_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint

UPDATE "users" SET "phone_gate_exempt" = true;--> statement-breakpoint

-- The old unique index covered EVERY non-null phone, including the unverified
-- strings the signup form has been writing since launch. That let a stranger's
-- typo permanently block the real owner from ever verifying their own number --
-- a denial of service on the primary identity. Only *verified* numbers should
-- be exclusive; unverified claims are released on verification by someone else.
DROP INDEX IF EXISTS "users_phone_key";--> statement-breakpoint

CREATE UNIQUE INDEX "users_phone_verified_key"
  ON "users" USING btree ("phone" text_ops)
  WHERE "is_phone_verified" = true;--> statement-breakpoint

-- Unverified claims are still looked up on every verification attempt (to be
-- released), and the gate reads the two new flags on every request.
CREATE INDEX "users_phone_unverified_idx"
  ON "users" USING btree ("phone" text_ops)
  WHERE "is_phone_verified" = false;
