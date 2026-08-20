// Auth tables only.
//
// The full schema lives in apps/api/src/db/schema.ts and is the source of
// truth — that is the file drizzle-kit generates migrations from. Web talks to
// the database in exactly one place: the better-auth drizzle adapter in
// ./auth.ts, which needs these five tables and nothing else. Everything else
// web needs goes through the API.
//
// This file used to be a full copy of the API schema and had already drifted
// (missing the blocks/reports/terms migration, and two_factor.id declared uuid
// when the column is text). Keeping only what the adapter uses keeps that
// surface small: when one of these five changes in the API schema, mirror it
// here.
import { pgTable, index, foreignKey, uuid, text, boolean, timestamp, uniqueIndex, varchar, integer, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const membershipTier = pgEnum("MembershipTier", ['FREE', 'SILVER', 'GOLD'])
export const role = pgEnum("Role", ['USER', 'ADMIN', 'SUPER_ADMIN'])

export const users = pgTable("users", {
	id: uuid().primaryKey().notNull(),
	publicId: varchar("public_id", { length: 16 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 20 }),
	name: text(),
	image: text(),
	emailVerified: boolean("emailVerified").default(false).notNull(),
	passwordHash: text("password_hash"),
	role: role().default('USER').notNull(),
	membershipTier: membershipTier("membership_tier").default('FREE').notNull(),
	isVerified: boolean("is_verified").default(false).notNull(),
	isPhoneVerified: boolean("is_phone_verified").default(false).notNull(),
	termsAcceptedAt: timestamp("terms_accepted_at", { precision: 3, mode: 'string' }),
	membershipExpiresAt: timestamp("membership_expires_at", { precision: 3, mode: 'string' }),
	rankBoost: integer("rank_boost").default(0).notNull(),
	rankBoostedAt: timestamp("rank_boosted_at", { precision: 3, mode: 'string' }),
	lastLoginAt: timestamp("last_login_at", { precision: 3, mode: 'string' }),
	twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
	emailVerificationToken: text("email_verification_token"),
	emailVerificationExpiry: timestamp("email_verification_expiry", { precision: 3, mode: 'string' }),
	emailVerifiedAt: timestamp("email_verified_at", { precision: 3, mode: 'string' }),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("users_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex("users_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	uniqueIndex("users_email_verification_token_key").using("btree", table.emailVerificationToken.asc().nullsLast().op("text_ops")),
	index("users_membership_tier_idx").using("btree", table.membershipTier.asc().nullsLast().op("enum_ops")),
	uniqueIndex("users_phone_key").using("btree", table.phone.asc().nullsLast().op("text_ops")),
	index("users_public_id_idx").using("btree", table.publicId.asc().nullsLast().op("text_ops")),
	uniqueIndex("users_public_id_key").using("btree", table.publicId.asc().nullsLast().op("text_ops")),
]);

export const session = pgTable("session", {
	id: uuid().primaryKey().notNull(),
	expiresAt: timestamp("expiresAt", { precision: 3, mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("createdAt", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: 'string' }).notNull(),
	ipAddress: text("ipAddress"),
	userAgent: text("userAgent"),
	userId: uuid("userId").notNull(),
	twoFactorVerified: boolean("two_factor_verified").default(false),
	factors: text("factors"),
}, (table) => [
	uniqueIndex("session_token_key").using("btree", table.token.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "session_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const account = pgTable("account", {
	id: uuid().primaryKey().notNull(),
	accountId: text("accountId").notNull(),
	providerId: text("providerId").notNull(),
	userId: uuid("userId").notNull(),
	accessToken: text("accessToken"),
	refreshToken: text("refreshToken"),
	idToken: text("idToken"),
	accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { precision: 3, mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { precision: 3, mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("createdAt", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "account_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const verification = pgTable("verification", {
	id: uuid().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expiresAt", { precision: 3, mode: 'string' }).notNull(),
	createdAt: timestamp("createdAt", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: 'string' }),
});

export const twoFactor = pgTable("two_factor", {
	id: text().primaryKey().notNull(),
	secret: text().notNull(),
	backupCodes: text("backup_codes").notNull(),
	userId: uuid("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "two_factor_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);
