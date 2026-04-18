-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."CampaignStatus" AS ENUM('DRAFT', 'SENDING', 'SENT');--> statement-breakpoint
CREATE TYPE "public"."Gender" AS ENUM('MALE', 'FEMALE');--> statement-breakpoint
CREATE TYPE "public"."MembershipTier" AS ENUM('FREE', 'SILVER', 'GOLD');--> statement-breakpoint
CREATE TYPE "public"."PhotoType" AS ENUM('AI_AVATAR', 'REAL_PHOTO');--> statement-breakpoint
CREATE TYPE "public"."PhotoVisibility" AS ENUM('PRIVATE', 'APPROVED_ONLY');--> statement-breakpoint
CREATE TYPE "public"."RequestStatus" AS ENUM('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."Role" AS ENUM('USER', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "PhotoType" NOT NULL,
	"gcs_original_path" text,
	"gcs_thumbnail_path" text,
	"gcs_display_path" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"visibility" "PhotoVisibility" DEFAULT 'PRIVATE' NOT NULL,
	"admin_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "info_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"requester_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"status" "RequestStatus" DEFAULT 'PENDING' NOT NULL,
	"allowed_shares" text[],
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expires_at" timestamp(3) NOT NULL,
	"responded_at" timestamp(3),
	"one_time_token" text,
	"token_used_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "skip_reasons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"requester_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"reason_code" varchar(50) NOT NULL,
	"custom_text" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"content_enc" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"website" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"partner_id" uuid NOT NULL,
	"title" varchar(100) NOT NULL,
	"image_url" text NOT NULL,
	"click_url" text NOT NULL,
	"frequency_rules" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"start_date" timestamp(3),
	"end_date" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "ad_impressions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ad_id" uuid NOT NULL,
	"user_id" uuid,
	"clicked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_schemas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(16) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"name" text,
	"image" text,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"role" "Role" DEFAULT 'USER' NOT NULL,
	"membership_tier" "MembershipTier" DEFAULT 'FREE' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_phone_verified" boolean DEFAULT false NOT NULL,
	"membership_expires_at" timestamp(3),
	"rank_boost" integer DEFAULT 0 NOT NULL,
	"rank_boosted_at" timestamp(3),
	"last_login_at" timestamp(3),
	"two_factor_secret" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_backup_codes" text[],
	"email_verification_token" text,
	"email_verification_expiry" timestamp(3),
	"email_verified_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"partner_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"redirect_url" text NOT NULL,
	"tracking_params" jsonb,
	"valid_from" timestamp(3),
	"valid_until" timestamp(3),
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_fields" (
	"id" uuid PRIMARY KEY NOT NULL,
	"schema_id" uuid NOT NULL,
	"field_name" varchar(50) NOT NULL,
	"field_type" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"placeholder" varchar(200),
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb,
	"display_order" integer NOT NULL,
	"is_encrypted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_by_id" uuid NOT NULL,
	"subject" varchar(200) NOT NULL,
	"template" text NOT NULL,
	"status" "CampaignStatus" DEFAULT 'DRAFT' NOT NULL,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp(3),
	"sent_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sent" boolean DEFAULT false NOT NULL,
	"opened" boolean DEFAULT false NOT NULL,
	"unsubscribed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unsubscribes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skip_reason_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"display_order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name_enc" text NOT NULL,
	"dob" date NOT NULL,
	"gender" "Gender" NOT NULL,
	"ethnicity" varchar(50) NOT NULL,
	"city" varchar(100),
	"state" varchar(50),
	"bio_enc" text,
	"biodata_json_enc" text,
	"public_fields" jsonb,
	"ai_avatar_id" uuid,
	"profile_complete" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" uuid NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp(3),
	"refreshTokenExpiresAt" timestamp(3),
	"scope" text,
	"password" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "info_requests" ADD CONSTRAINT "info_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "info_requests" ADD CONSTRAINT "info_requests_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "skip_reasons" ADD CONSTRAINT "skip_reasons_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "skip_reasons" ADD CONSTRAINT "skip_reasons_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "public"."form_schemas"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "unsubscribes" ADD CONSTRAINT "unsubscribes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_ai_avatar_id_fkey" FOREIGN KEY ("ai_avatar_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "photos_user_id_type_idx" ON "photos" USING btree ("user_id" uuid_ops,"type" uuid_ops);--> statement-breakpoint
CREATE INDEX "photos_visibility_idx" ON "photos" USING btree ("visibility" enum_ops);--> statement-breakpoint
CREATE INDEX "info_requests_expires_at_idx" ON "info_requests" USING btree ("expires_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "info_requests_one_time_token_key" ON "info_requests" USING btree ("one_time_token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "info_requests_requester_id_status_key" ON "info_requests" USING btree ("requester_id" enum_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "info_requests_target_id_status_idx" ON "info_requests" USING btree ("target_id" enum_ops,"status" uuid_ops);--> statement-breakpoint
CREATE INDEX "skip_reasons_requester_id_idx" ON "skip_reasons" USING btree ("requester_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "messages_recipient_id_is_read_idx" ON "messages" USING btree ("recipient_id" bool_ops,"is_read" uuid_ops);--> statement-breakpoint
CREATE INDEX "messages_sender_id_recipient_id_idx" ON "messages" USING btree ("sender_id" uuid_ops,"recipient_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ads_is_active_start_date_end_date_idx" ON "ads" USING btree ("is_active" bool_ops,"start_date" timestamp_ops,"end_date" bool_ops);--> statement-breakpoint
CREATE INDEX "ad_impressions_ad_id_created_at_idx" ON "ad_impressions" USING btree ("ad_id" timestamp_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_verification_token_key" ON "users" USING btree ("email_verification_token" text_ops);--> statement-breakpoint
CREATE INDEX "users_membership_tier_idx" ON "users" USING btree ("membership_tier" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_key" ON "users" USING btree ("phone" text_ops);--> statement-breakpoint
CREATE INDEX "users_public_id_idx" ON "users" USING btree ("public_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_public_id_key" ON "users" USING btree ("public_id" text_ops);--> statement-breakpoint
CREATE INDEX "coupons_is_active_valid_from_valid_until_idx" ON "coupons" USING btree ("is_active" bool_ops,"valid_from" timestamp_ops,"valid_until" bool_ops);--> statement-breakpoint
CREATE INDEX "form_fields_schema_id_display_order_idx" ON "form_fields" USING btree ("schema_id" int4_ops,"display_order" int4_ops);--> statement-breakpoint
CREATE INDEX "email_campaigns_status_idx" ON "email_campaigns" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_recipients_campaign_id_user_id_key" ON "campaign_recipients" USING btree ("campaign_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "unsubscribes_user_id_key" ON "unsubscribes" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "skip_reason_options_code_key" ON "skip_reason_options" USING btree ("code" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_key" ON "session" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "profiles_ethnicity_idx" ON "profiles" USING btree ("ethnicity" text_ops);--> statement-breakpoint
CREATE INDEX "profiles_gender_idx" ON "profiles" USING btree ("gender" enum_ops);--> statement-breakpoint
CREATE INDEX "profiles_profile_complete_idx" ON "profiles" USING btree ("profile_complete" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action" text_ops);--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs" USING btree ("user_id" timestamp_ops,"created_at" timestamp_ops);
*/