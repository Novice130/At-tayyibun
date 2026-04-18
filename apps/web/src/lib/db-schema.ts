import { pgTable, index, foreignKey, uuid, text, boolean, timestamp, uniqueIndex, varchar, jsonb, integer, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const campaignStatus = pgEnum("CampaignStatus", ['DRAFT', 'SENDING', 'SENT'])
export const gender = pgEnum("Gender", ['MALE', 'FEMALE'])
export const membershipTier = pgEnum("MembershipTier", ['FREE', 'SILVER', 'GOLD'])
export const photoType = pgEnum("PhotoType", ['AI_AVATAR', 'REAL_PHOTO'])
export const photoVisibility = pgEnum("PhotoVisibility", ['PRIVATE', 'APPROVED_ONLY'])
export const requestStatus = pgEnum("RequestStatus", ['PENDING', 'APPROVED', 'DENIED', 'EXPIRED'])
export const role = pgEnum("Role", ['USER', 'ADMIN', 'SUPER_ADMIN'])


export const photos = pgTable("photos", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: photoType().notNull(),
	gcsOriginalPath: text("gcs_original_path"),
	gcsThumbnailPath: text("gcs_thumbnail_path"),
	gcsDisplayPath: text("gcs_display_path"),
	isPrimary: boolean("is_primary").default(false).notNull(),
	visibility: photoVisibility().default('PRIVATE').notNull(),
	adminApproved: boolean("admin_approved").default(false).notNull(),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("photos_user_id_type_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.type.asc().nullsLast().op("uuid_ops")),
	index("photos_visibility_idx").using("btree", table.visibility.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "photos_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const infoRequests = pgTable("info_requests", {
	id: uuid().primaryKey().notNull(),
	requesterId: uuid("requester_id").notNull(),
	targetId: uuid("target_id").notNull(),
	status: requestStatus().default('PENDING').notNull(),
	allowedShares: text("allowed_shares").array(),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	expiresAt: timestamp("expires_at", { precision: 3, mode: 'string' }).notNull(),
	respondedAt: timestamp("responded_at", { precision: 3, mode: 'string' }),
	oneTimeToken: text("one_time_token"),
	tokenUsedAt: timestamp("token_used_at", { precision: 3, mode: 'string' }),
}, (table) => [
	index("info_requests_expires_at_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex("info_requests_one_time_token_key").using("btree", table.oneTimeToken.asc().nullsLast().op("text_ops")),
	uniqueIndex("info_requests_requester_id_status_key").using("btree", table.requesterId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("enum_ops")),
	index("info_requests_target_id_status_idx").using("btree", table.targetId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.requesterId],
			foreignColumns: [users.id],
			name: "info_requests_requester_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.targetId],
			foreignColumns: [users.id],
			name: "info_requests_target_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const skipReasons = pgTable("skip_reasons", {
	id: uuid().primaryKey().notNull(),
	requesterId: uuid("requester_id").notNull(),
	targetId: uuid("target_id").notNull(),
	reasonCode: varchar("reason_code", { length: 50 }).notNull(),
	customText: text("custom_text"),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("skip_reasons_requester_id_idx").using("btree", table.requesterId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.requesterId],
			foreignColumns: [users.id],
			name: "skip_reasons_requester_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.targetId],
			foreignColumns: [users.id],
			name: "skip_reasons_target_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const messages = pgTable("messages", {
	id: uuid().primaryKey().notNull(),
	senderId: uuid("sender_id").notNull(),
	recipientId: uuid("recipient_id").notNull(),
	contentEnc: text("content_enc").notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("messages_recipient_id_is_read_idx").using("btree", table.recipientId.asc().nullsLast().op("bool_ops"), table.isRead.asc().nullsLast().op("uuid_ops")),
	index("messages_sender_id_recipient_id_idx").using("btree", table.senderId.asc().nullsLast().op("uuid_ops"), table.recipientId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [users.id],
			name: "messages_sender_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.recipientId],
			foreignColumns: [users.id],
			name: "messages_recipient_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const partners = pgTable("partners", {
	id: uuid().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	website: varchar({ length: 255 }),
	isActive: boolean("is_active").default(true).notNull(),
});

export const ads = pgTable("ads", {
	id: uuid().primaryKey().notNull(),
	partnerId: uuid("partner_id").notNull(),
	title: varchar({ length: 100 }).notNull(),
	imageUrl: text("image_url").notNull(),
	clickUrl: text("click_url").notNull(),
	frequencyRules: jsonb("frequency_rules").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	startDate: timestamp("start_date", { precision: 3, mode: 'string' }),
	endDate: timestamp("end_date", { precision: 3, mode: 'string' }),
}, (table) => [
	index("ads_is_active_start_date_end_date_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops"), table.startDate.asc().nullsLast().op("timestamp_ops"), table.endDate.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "ads_partner_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const adImpressions = pgTable("ad_impressions", {
	id: uuid().primaryKey().notNull(),
	adId: uuid("ad_id").notNull(),
	userId: uuid("user_id"),
	clicked: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("ad_impressions_ad_id_created_at_idx").using("btree", table.adId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.adId],
			foreignColumns: [ads.id],
			name: "ad_impressions_ad_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const formSchemas = pgTable("form_schemas", {
	id: uuid().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	version: integer().default(1).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const users = pgTable("users", {
	id: uuid().primaryKey().notNull(),
	publicId: varchar("public_id", { length: 16 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 20 }),
	name: text(),
	image: text(),
	emailVerified: boolean().default(false).notNull(),
	passwordHash: text("password_hash"),
	role: role().default('USER').notNull(),
	membershipTier: membershipTier("membership_tier").default('FREE').notNull(),
	isVerified: boolean("is_verified").default(false).notNull(),
	isPhoneVerified: boolean("is_phone_verified").default(false).notNull(),
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

export const coupons = pgTable("coupons", {
	id: uuid().primaryKey().notNull(),
	partnerId: uuid("partner_id").notNull(),
	code: varchar({ length: 50 }).notNull(),
	description: text(),
	redirectUrl: text("redirect_url").notNull(),
	trackingParams: jsonb("tracking_params"),
	validFrom: timestamp("valid_from", { precision: 3, mode: 'string' }),
	validUntil: timestamp("valid_until", { precision: 3, mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	index("coupons_is_active_valid_from_valid_until_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops"), table.validFrom.asc().nullsLast().op("timestamp_ops"), table.validUntil.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "coupons_partner_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const formFields = pgTable("form_fields", {
	id: uuid().primaryKey().notNull(),
	schemaId: uuid("schema_id").notNull(),
	fieldName: varchar("field_name", { length: 50 }).notNull(),
	fieldType: varchar("field_type", { length: 30 }).notNull(),
	label: varchar({ length: 100 }).notNull(),
	placeholder: varchar({ length: 200 }),
	required: boolean().default(false).notNull(),
	options: jsonb(),
	displayOrder: integer("display_order").notNull(),
	isEncrypted: boolean("is_encrypted").default(false).notNull(),
}, (table) => [
	index("form_fields_schema_id_display_order_idx").using("btree", table.schemaId.asc().nullsLast().op("int4_ops"), table.displayOrder.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.schemaId],
			foreignColumns: [formSchemas.id],
			name: "form_fields_schema_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const emailCampaigns = pgTable("email_campaigns", {
	id: uuid().primaryKey().notNull(),
	createdById: uuid("created_by_id").notNull(),
	subject: varchar({ length: 200 }).notNull(),
	template: text().notNull(),
	status: campaignStatus().default('DRAFT').notNull(),
	totalRecipients: integer("total_recipients").default(0).notNull(),
	sentCount: integer("sent_count").default(0).notNull(),
	scheduledAt: timestamp("scheduled_at", { precision: 3, mode: 'string' }),
	sentAt: timestamp("sent_at", { precision: 3, mode: 'string' }),
}, (table) => [
	index("email_campaigns_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "email_campaigns_created_by_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const campaignRecipients = pgTable("campaign_recipients", {
	id: uuid().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	userId: uuid("user_id").notNull(),
	sent: boolean().default(false).notNull(),
	opened: boolean().default(false).notNull(),
	unsubscribed: boolean().default(false).notNull(),
}, (table) => [
	uniqueIndex("campaign_recipients_campaign_id_user_id_key").using("btree", table.campaignId.asc().nullsLast().op("uuid_ops"), table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [emailCampaigns.id],
			name: "campaign_recipients_campaign_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "campaign_recipients_user_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const systemConfig = pgTable("system_config", {
	key: varchar({ length: 100 }).primaryKey().notNull(),
	value: jsonb().notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).notNull(),
});

export const unsubscribes = pgTable("unsubscribes", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("unsubscribes_user_id_key").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "unsubscribes_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const skipReasonOptions = pgTable("skip_reason_options", {
	id: uuid().primaryKey().notNull(),
	code: varchar({ length: 50 }).notNull(),
	label: varchar({ length: 100 }).notNull(),
	displayOrder: integer("display_order").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	uniqueIndex("skip_reason_options_code_key").using("btree", table.code.asc().nullsLast().op("text_ops")),
]);

export const session = pgTable("session", {
	id: uuid().primaryKey().notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	ipAddress: text(),
	userAgent: text(),
	userId: uuid().notNull(),
}, (table) => [
	uniqueIndex("session_token_key").using("btree", table.token.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "session_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const verification = pgTable("verification", {
	id: uuid().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp({ precision: 3, mode: 'string' }),
});

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastNameEnc: text("last_name_enc").notNull(),
	dob: date().notNull(),
	gender: gender().notNull(),
	ethnicity: varchar({ length: 50 }).notNull(),
	city: varchar({ length: 100 }),
	state: varchar({ length: 50 }),
	bioEnc: text("bio_enc"),
	biodataJsonEnc: text("biodata_json_enc"),
	publicFields: jsonb("public_fields"),
	aiAvatarId: uuid("ai_avatar_id"),
	profileComplete: boolean("profile_complete").default(false).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("profiles_ethnicity_idx").using("btree", table.ethnicity.asc().nullsLast().op("text_ops")),
	index("profiles_gender_idx").using("btree", table.gender.asc().nullsLast().op("enum_ops")),
	index("profiles_profile_complete_idx").using("btree", table.profileComplete.asc().nullsLast().op("bool_ops")),
	uniqueIndex("profiles_user_id_key").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "profiles_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.aiAvatarId],
			foreignColumns: [photos.id],
			name: "profiles_ai_avatar_id_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const auditLogs = pgTable("audit_logs", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id"),
	action: varchar({ length: 100 }).notNull(),
	resourceType: varchar("resource_type", { length: 50 }).notNull(),
	resourceId: uuid("resource_id"),
	metadata: jsonb(),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: varchar("user_agent", { length: 500 }),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("audit_logs_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("audit_logs_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("audit_logs_user_id_created_at_idx").using("btree", table.userId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "audit_logs_user_id_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const account = pgTable("account", {
	id: uuid().primaryKey().notNull(),
	accountId: text().notNull(),
	providerId: text().notNull(),
	userId: uuid().notNull(),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: timestamp({ precision: 3, mode: 'string' }),
	refreshTokenExpiresAt: timestamp({ precision: 3, mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "account_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const twoFactor = pgTable("two_factor", {
	id: uuid().primaryKey().notNull(),
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
