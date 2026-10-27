-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_CONFIRMATION', 'PLACED', 'ACCEPTED_BY_KITCHEN', 'PREPARING', 'RIDER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BrandOrderStatus" AS ENUM ('SENT_TO_KITCHEN', 'ACCEPTED', 'PREPARING', 'READY', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_HUB', 'PICKED_UP', 'ARRIVING', 'DELIVERED', 'STALE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdminSubRole" AS ENUM ('SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN', 'MARKETING_ADMIN');

-- CreateEnum
CREATE TYPE "RiderStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('HOME', 'WORK', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "adminSubRole" "AdminSubRole",
    "scopedHubId" TEXT,
    "scopedBrandId" TEXT,
    "walletBalance" INTEGER NOT NULL DEFAULT 0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "referralCode" TEXT NOT NULL,
    "referredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AddressType" NOT NULL DEFAULT 'HOME',
    "label" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "resolvedHubId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "cuisine" TEXT[],
    "logoUrl" TEXT NOT NULL,
    "heroImageUrl" TEXT NOT NULL,
    "themeColor" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOwned" BOOLEAN NOT NULL DEFAULT true,
    "commissionPct" DOUBLE PRECISION,
    "minOrderValue" INTEGER NOT NULL DEFAULT 149,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hubs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "servicePolygon" JSONB NOT NULL,
    "operatingHoursStart" TEXT,
    "operatingHoursEnd" TEXT,

    CONSTRAINT "hubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_kitchens" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "brand_kitchens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "brandKitchenId" TEXT NOT NULL,
    "menuItemGroupId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mrpInPaise" INTEGER NOT NULL,
    "memberPriceInPaise" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isVeg" BOOLEAN NOT NULL DEFAULT true,
    "isBestseller" BOOLEAN NOT NULL DEFAULT false,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
    "dietType" TEXT,
    "spiceLevel" INTEGER,
    "gstPct" INTEGER,
    "variants" JSONB,
    "addOns" JSONB,
    "scheduledFrom" TEXT,
    "scheduledTo" TEXT,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "optionsSnapshot" JSONB,
    "unitPricePaise" INTEGER NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "paymentMethod" TEXT NOT NULL DEFAULT 'UPI',
    "mrpTotalPaise" INTEGER NOT NULL,
    "memberSavingsPaise" INTEGER NOT NULL,
    "deliveryFeePaise" INTEGER NOT NULL DEFAULT 0,
    "packagingFeePaise" INTEGER NOT NULL DEFAULT 0,
    "taxPaise" INTEGER NOT NULL,
    "walletAppliedPaise" INTEGER NOT NULL DEFAULT 0,
    "finalPaidPaise" INTEGER NOT NULL,
    "estimatedDeliveryMins" INTEGER NOT NULL DEFAULT 30,
    "discountBreakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_orders" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "BrandOrderStatus" NOT NULL DEFAULT 'SENT_TO_KITCHEN',
    "rejectedAt" TIMESTAMP(3),
    "rejectReason" TEXT,

    CONSTRAINT "brand_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "brandOrderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "mrpSnapshot" INTEGER NOT NULL DEFAULT 0,
    "priceSnapshot" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'razorpay',
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "amountInPaise" INTEGER NOT NULL,
    "refundedAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "refundId" TEXT,
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "renewsAt" TIMESTAMP(3),

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "priceInPaise" INTEGER NOT NULL,
    "flatDiscountPct" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brandId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "config" JSONB NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riders" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RiderStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "vehicleType" TEXT NOT NULL,
    "vehicleRegNo" TEXT,
    "licenceDocUrl" TEXT,
    "vehicleRcDocUrl" TEXT,
    "bankAccountRef" TEXT,
    "upiId" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "liveLat" DOUBLE PRECISION,
    "liveLng" DOUBLE PRECISION,
    "currentHubId" TEXT,
    "capacityMax" INTEGER NOT NULL DEFAULT 1,
    "rating" DOUBLE PRECISION DEFAULT 5.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rider_earnings" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "tripId" TEXT,
    "type" TEXT NOT NULL,
    "amountInPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rider_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "raisedByType" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "orderId" TEXT,
    "category" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_trips" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "riderId" TEXT,
    "status" "TripStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "pickupLat" DOUBLE PRECISION NOT NULL,
    "pickupLng" DOUBLE PRECISION NOT NULL,
    "liveLat" DOUBLE PRECISION,
    "liveLng" DOUBLE PRECISION,
    "deliveryOtp" TEXT,
    "otpVerifiedAt" TIMESTAMP(3),
    "proofPhotoUrl" TEXT,
    "lastPingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountInPaise" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "diff" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brand_kitchens_brandId_hubId_key" ON "brand_kitchens"("brandId", "hubId");

-- CreateIndex
CREATE INDEX "menu_items_brandKitchenId_isAvailable_idx" ON "menu_items"("brandKitchenId", "isAvailable");

-- CreateIndex
CREATE INDEX "menu_items_menuItemGroupId_idx" ON "menu_items"("menuItemGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "carts_userId_key" ON "carts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "brand_orders_orderId_status_idx" ON "brand_orders"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_gatewayOrderId_idx" ON "payments"("gatewayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_key" ON "memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "riders_phone_key" ON "riders"("phone");

-- CreateIndex
CREATE INDEX "riders_status_isOnline_idx" ON "riders"("status", "isOnline");

-- CreateIndex
CREATE INDEX "rider_earnings_riderId_createdAt_idx" ON "rider_earnings"("riderId", "createdAt");

-- CreateIndex
CREATE INDEX "tickets_status_priority_idx" ON "tickets"("status", "priority");

-- CreateIndex
CREATE INDEX "tickets_raisedById_idx" ON "tickets"("raisedById");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_trips_orderId_key" ON "delivery_trips"("orderId");

-- CreateIndex
CREATE INDEX "wallet_transactions_userId_createdAt_idx" ON "wallet_transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_kitchens" ADD CONSTRAINT "brand_kitchens_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_kitchens" ADD CONSTRAINT "brand_kitchens_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_brandKitchenId_fkey" FOREIGN KEY ("brandKitchenId") REFERENCES "brand_kitchens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_orders" ADD CONSTRAINT "brand_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_brandOrderId_fkey" FOREIGN KEY ("brandOrderId") REFERENCES "brand_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riders" ADD CONSTRAINT "riders_currentHubId_fkey" FOREIGN KEY ("currentHubId") REFERENCES "hubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_earnings" ADD CONSTRAINT "rider_earnings_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_trips" ADD CONSTRAINT "delivery_trips_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_trips" ADD CONSTRAINT "delivery_trips_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

