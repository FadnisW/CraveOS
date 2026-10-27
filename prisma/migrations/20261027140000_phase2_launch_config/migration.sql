-- Phase 2 launch configuration.
--
-- 1. Customer accounts are email-first: `phone` becomes nullable and is only
--    stored once a real delivery contact is supplied. The old signup flow wrote
--    a random phone number, which was fake data.
-- 2. Wallet ledger rows gain a typed reference for non-order movements
--    (membership purchases and referral rewards).
-- 3. Membership purchases gain an idempotency key so a double-tapped purchase
--    cannot debit the wallet twice.
-- 4. The launch membership plans and welcome promotion are real configuration,
--    not demo seed data, so production gets them from the migration.

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "wallet_transactions"
  ADD COLUMN "referenceType" TEXT,
  ADD COLUMN "referenceId" TEXT;

-- AlterTable
ALTER TABLE "membership_purchases" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "membership_purchases_idempotencyKey_key" ON "membership_purchases"("idempotencyKey");

-- Launch membership plans. Prices are in paise.
INSERT INTO "membership_plans"
  ("id", "slug", "name", "description", "durationDays", "priceInPaise", "flatDiscountPct", "isTrial", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('plan-trial', 'trial', 'Free Trial', '30 days of member prices and free delivery.', 30, 0, 30, true, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-monthly', 'monthly', 'Monthly Membership', 'Member prices and free delivery for 30 days.', 30, 9900, 30, false, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-quarterly', 'quarterly', 'Quarterly Membership', 'Member prices and free delivery for 90 days.', 90, 24900, 30, false, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-annual', 'annual', 'Annual Membership', 'Member prices and free delivery for 365 days.', 365, 89900, 30, false, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "slug" = EXCLUDED."slug",
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "durationDays" = EXCLUDED."durationDays",
  "priceInPaise" = EXCLUDED."priceInPaise",
  "flatDiscountPct" = EXCLUDED."flatDiscountPct",
  "isTrial" = EXCLUDED."isTrial",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Launch promotions. These are the only customer-visible codes until marketing
-- creates more through the admin API.
INSERT INTO "promotions"
  ("id", "code", "name", "description", "type", "value", "minOrderPaise", "maxDiscountPaise", "brandId", "hubId", "startsAt", "endsAt", "status", "totalUsageLimit", "perUserLimit", "firstOrderOnly", "createdById", "reviewedById", "reviewedAt", "createdAt", "updatedAt")
VALUES
  ('promo-welcome100', 'WELCOME100', 'Welcome ₹100 off', '₹100 off your first order above ₹199.', 'FLAT', 10000, 19900, 10000, NULL, NULL, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '10 years', 'APPROVED', NULL, 1, true, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('promo-eatclub100', 'EATCLUB100', '₹100 off ₹499', '₹100 off orders above ₹499.', 'FLAT', 10000, 49900, 10000, NULL, NULL, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '10 years', 'APPROVED', NULL, 1, false, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('promo-crave50', 'CRAVE50', '₹50 off ₹299', '₹50 off orders above ₹299.', 'FLAT', 5000, 29900, 5000, NULL, NULL, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '10 years', 'APPROVED', NULL, 2, false, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
