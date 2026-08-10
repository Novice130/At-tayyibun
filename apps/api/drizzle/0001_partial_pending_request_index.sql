-- The old unique index covered (requester_id, status) across ALL statuses, so a
-- requester could hold at most one row per status for their whole lifetime.
-- Declining a user's second request raised a unique violation on the UPDATE to
-- 'DENIED', surfacing as a 500 and skipping the notification email + audit log.
-- Replace it with a partial unique index that enforces what the app actually
-- wants: one PENDING request per requester at a time.
DROP INDEX IF EXISTS "info_requests_requester_id_status_key";--> statement-breakpoint

-- Release rows already past their expiry so the partial index can be created
-- even if historical data violates the one-pending-per-requester rule.
UPDATE "info_requests" SET "status" = 'EXPIRED'
WHERE "status" = 'PENDING' AND "expires_at" < now();--> statement-breakpoint

-- Keep only the newest PENDING row per requester; expire any older duplicates.
UPDATE "info_requests" SET "status" = 'EXPIRED'
WHERE "status" = 'PENDING' AND "id" NOT IN (
  SELECT DISTINCT ON ("requester_id") "id"
  FROM "info_requests"
  WHERE "status" = 'PENDING'
  ORDER BY "requester_id", "created_at" DESC
);--> statement-breakpoint

CREATE UNIQUE INDEX "info_requests_requester_pending_key"
  ON "info_requests" USING btree ("requester_id" uuid_ops)
  WHERE "status" = 'PENDING';
