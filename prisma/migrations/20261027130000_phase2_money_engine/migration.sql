-- Phase 2: real promotion engine, purchasable memberships and a referral ledger.
--
-- This migration is data-preserving:
--   * Existing membership plans get a slug.
--   * A free-trial plan is created and every dangling membership planId is
--     repointed at it before the foreign key is added.
--   * Legacy membership expiry is consolidated into a single endsAt column.
--   * Legacy pricing_rules rows that look like real promotions are copied into
--     promotions. Rows created by pre-launch smoke tests (label "Smoke ...")
--     are discarded with the old table.

-- CreateEnum
CREATE TYPE "MembershipPurchaseStatus" AS ENUM ('INITIATED', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENT', 'FLAT', 'FREE_DELIVERY');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REWARDED', 'CANCELLED');

-- AlterTable: membership plans get a stable public slug and lifecycle fields.
ALTER TABLE "membership_plans"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "isTrial" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "membership_plans"
SET "slug" = lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'));

-- Guarantee uniqueness before the unique index is created.
UPDATE "membership_plans"
SET "slug" = "slug" || '-' || substr("id", 1, 6)
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (PARTITION BY "slug" ORDER BY "id") AS rn
    FROM "membership_plans"
  ) ranked
  WHERE ranked.rn > 1
);

UPDATE "membership_plans"
SET "slug" = 'plan-' || substr("id", 1, 8)
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "membership_plans" ALTER COLUMN "slug" SET NOT NULL;

-- A trial plan must exist before memberships can reference one.
INSERT INTO "membership_plans"
  ("id", "slug", "name", "description", "durationDays", "priceInPaise", "flatDiscountPct", "isTrial", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('plan-trial', 'trial', 'Free Trial', '30 days of member prices and free delivery.', 30, 0, 30, true, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- AlterTable: one expiry field instead of two contradictory ones.
ALTER TABLE "memberships"
  ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "memberships"
SET "endsAt" = COALESCE("trialEndsAt", "renewsAt", CURRENT_TIMESTAMP + INTERVAL '30 days');

UPDATE "memberships" m
SET "planId" = COALESCE(
  (SELECT "id" FROM "membership_plans" WHERE "isTrial" = true ORDER BY "sortOrder" LIMIT 1),
  'plan-trial'
)
WHERE NOT EXISTS (
  SELECT 1 FROM "membership_plans" p WHERE p."id" = m."planId"
);

ALTER TABLE "memberships" ALTER COLUMN "endsAt" SET NOT NULL;

ALTER TABLE "memberships"
  DROP COLUMN "renewsAt",
  DROP COLUMN "trialEndsAt";

-- CreateTable
CREATE TABLE "membership_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "MembershipPurchaseStatus" NOT NULL DEFAULT 'INITIATED',
    "amountInPaise" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PromotionType" NOT NULL,
    "value" INTEGER NOT NULL,
    "minOrderPaise" INTEGER NOT NULL DEFAULT 0,
    "maxDiscountPaise" INTEGER,
    "brandId" TEXT,
    "hubId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
    "totalUsageLimit" INTEGER,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_redemptions" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "discountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "rewardPaise" INTEGER NOT NULL DEFAULT 0,
    "refereeRewardPaise" INTEGER NOT NULL DEFAULT 0,
    "qualifiedAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- Copy real legacy pricing rules before dropping the old table.
INSERT INTO "promotions" (
  "id", "code", "name", "description", "type", "value", "minOrderPaise",
  "maxDiscountPaise", "brandId", "hubId", "startsAt", "endsAt", "status",
  "totalUsageLimit", "perUserLimit", "firstOrderOnly", "createdById",
  "reviewedById", "reviewedAt", "createdAt", "updatedAt"
)
SELECT
  'promo-' || "id",
  upper(COALESCE("config"->>'code', 'PROMO-' || substr(replace("id", '-', ''), 1, 10))),
  COALESCE("config"->>'label', initcap(replace("type", '_', ' '))),
  "config"->>'description',
  CASE
    WHEN ("config"->>'discountPct') IS NOT NULL THEN 'PERCENT'::"PromotionType"
    ELSE 'FLAT'::"PromotionType"
  END,
  COALESCE(("config"->>'discountPct')::int, ("config"->>'flatDiscountPaise')::int, 0),
  COALESCE(("config"->>'minOrderPaise')::int, 0),
  ("config"->>'maxDiscountPaise')::int,
  "brandId",
  NULL,
  "startsAt",
  "endsAt",
  CASE "config"->>'status'
    WHEN 'PENDING_ADMIN_APPROVAL' THEN 'PENDING_APPROVAL'::"PromotionStatus"
    WHEN 'REJECTED' THEN 'REJECTED'::"PromotionStatus"
    WHEN 'DRAFT' THEN 'DRAFT'::"PromotionStatus"
    WHEN 'ARCHIVED' THEN 'ARCHIVED'::"PromotionStatus"
    ELSE 'APPROVED'::"PromotionStatus"
  END,
  NULL,
  1,
  false,
  "config"->>'proposedByBrandId',
  "config"->>'reviewedBy',
  CASE WHEN "config"->>'reviewedAt' IS NOT NULL THEN ("config"->>'reviewedAt')::timestamptz END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "pricing_rules"
WHERE COALESCE("config"->>'label', '') NOT LIKE 'Smoke %';

-- DropTable
DROP TABLE "pricing_rules";

-- CreateIndex
CREATE UNIQUE INDEX "membership_purchases_gatewayOrderId_key" ON "membership_purchases"("gatewayOrderId");

-- CreateIndex
CREATE INDEX "membership_purchases_userId_status_idx" ON "membership_purchases"("userId", "status");

-- CreateIndex
CREATE INDEX "membership_purchases_status_createdAt_idx" ON "membership_purchases"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "promotions_status_startsAt_endsAt_idx" ON "promotions"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "promotions_brandId_status_idx" ON "promotions"("brandId", "status");

-- CreateIndex
CREATE INDEX "promotions_hubId_status_idx" ON "promotions"("hubId", "status");

-- CreateIndex
CREATE INDEX "promotion_redemptions_userId_promotionId_idx" ON "promotion_redemptions"("userId", "promotionId");

-- CreateIndex
CREATE INDEX "promotion_redemptions_promotionId_createdAt_idx" ON "promotion_redemptions"("promotionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_redemptions_promotionId_orderId_key" ON "promotion_redemptions"("promotionId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_refereeId_key" ON "referrals"("refereeId");

-- CreateIndex
CREATE INDEX "referrals_referrerId_status_idx" ON "referrals"("referrerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_slug_key" ON "membership_plans"("slug");

-- CreateIndex
CREATE INDEX "memberships_status_endsAt_idx" ON "memberships"("status", "endsAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_planId_fkey" FOREIGN KEY ("planId") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_purchases" ADD CONSTRAINT "membership_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_purchases" ADD CONSTRAINT "membership_purchases_planId_fkey" FOREIGN KEY ("planId") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
