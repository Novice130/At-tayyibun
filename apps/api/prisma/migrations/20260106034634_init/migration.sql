-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('FREE', 'SILVER', 'GOLD');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('AI_AVATAR', 'REAL_PHOTO');

-- CreateEnum
CREATE TYPE "PhotoVisibility" AS ENUM ('PRIVATE', 'APPROVED_ONLY');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "public_id" VARCHAR(16) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "password_hash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "membership_tier" "MembershipTier" NOT NULL DEFAULT 'FREE',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "membership_expires_at" TIMESTAMP(3),
    "rank_boost" INTEGER NOT NULL DEFAULT 0,
    "rank_boosted_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name_enc" TEXT NOT NULL,
    "dob" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "ethnicity" VARCHAR(50) NOT NULL,
    "city" VARCHAR(100),
    "state" VARCHAR(50),
    "bio_enc" TEXT,
    "biodata_json_enc" TEXT,
    "public_fields" JSONB,
    "ai_avatar_id" UUID,
    "profile_complete" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "PhotoType" NOT NULL,
    "gcs_original_path" TEXT,
    "gcs_thumbnail_path" TEXT,
    "gcs_display_path" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "PhotoVisibility" NOT NULL DEFAULT 'PRIVATE',
    "admin_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "info_requests" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "allowed_shares" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "one_time_token" TEXT,
    "token_used_at" TIMESTAMP(3),

    CONSTRAINT "info_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skip_reasons" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "reason_code" VARCHAR(50) NOT NULL,
    "custom_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skip_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "content_enc" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "website" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "image_url" TEXT NOT NULL,
    "click_url" TEXT NOT NULL,
    "frequency_rules" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_impressions" (
    "id" UUID NOT NULL,
    "ad_id" UUID NOT NULL,
    "user_id" UUID,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "redirect_url" TEXT NOT NULL,
    "tracking_params" JSONB,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_schemas" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_fields" (
    "id" UUID NOT NULL,
    "schema_id" UUID NOT NULL,
    "field_name" VARCHAR(50) NOT NULL,
    "field_type" VARCHAR(30) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "placeholder" VARCHAR(200),
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "display_order" INTEGER NOT NULL,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" UUID,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "template" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unsubscribes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unsubscribes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "skip_reason_options" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "skip_reason_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_public_id_idx" ON "users"("public_id");

-- CreateIndex
CREATE INDEX "users_membership_tier_idx" ON "users"("membership_tier");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "profiles_gender_idx" ON "profiles"("gender");

-- CreateIndex
CREATE INDEX "profiles_ethnicity_idx" ON "profiles"("ethnicity");

-- CreateIndex
CREATE INDEX "profiles_profile_complete_idx" ON "profiles"("profile_complete");

-- CreateIndex
CREATE INDEX "photos_user_id_type_idx" ON "photos"("user_id", "type");

-- CreateIndex
CREATE INDEX "photos_visibility_idx" ON "photos"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "info_requests_one_time_token_key" ON "info_requests"("one_time_token");

-- CreateIndex
CREATE INDEX "info_requests_target_id_status_idx" ON "info_requests"("target_id", "status");

-- CreateIndex
CREATE INDEX "info_requests_expires_at_idx" ON "info_requests"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "info_requests_requester_id_status_key" ON "info_requests"("requester_id", "status");

-- CreateIndex
CREATE INDEX "skip_reasons_requester_id_idx" ON "skip_reasons"("requester_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_recipient_id_idx" ON "messages"("sender_id", "recipient_id");

-- CreateIndex
CREATE INDEX "messages_recipient_id_is_read_idx" ON "messages"("recipient_id", "is_read");

-- CreateIndex
CREATE INDEX "ads_is_active_start_date_end_date_idx" ON "ads"("is_active", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "ad_impressions_ad_id_created_at_idx" ON "ad_impressions"("ad_id", "created_at");

-- CreateIndex
CREATE INDEX "coupons_is_active_valid_from_valid_until_idx" ON "coupons"("is_active", "valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "form_fields_schema_id_display_order_idx" ON "form_fields"("schema_id", "display_order");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "email_campaigns_status_idx" ON "email_campaigns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_campaign_id_user_id_key" ON "campaign_recipients"("campaign_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "unsubscribes_user_id_key" ON "unsubscribes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "skip_reason_options_code_key" ON "skip_reason_options"("code");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_ai_avatar_id_fkey" FOREIGN KEY ("ai_avatar_id") REFERENCES "photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_requests" ADD CONSTRAINT "info_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_requests" ADD CONSTRAINT "info_requests_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skip_reasons" ADD CONSTRAINT "skip_reasons_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skip_reasons" ADD CONSTRAINT "skip_reasons_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "form_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unsubscribes" ADD CONSTRAINT "unsubscribes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
