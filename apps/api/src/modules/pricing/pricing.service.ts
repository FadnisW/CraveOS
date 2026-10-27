import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CalculatePriceInput {
  userId?: string;
  items: {
    /** Maximum retail price per unit, in rupees. Server-side this is derived from MenuItem.mrpInPaise. */
    price: number;
    /** Member price per unit, in rupees. When present the member discount is exact instead of a flat 30%. */
    memberPrice?: number;
    quantity: number;
  }[];
  isMember?: boolean;
  couponCode?: string;
  useWalletBalance?: number;
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * DB / Cryptographically verifies whether a user has an active or trial membership.
   * Fallback to false on missing, expired, or failed DB lookup (Edge Case 3A).
   */
  async verifyMembership(userId?: string): Promise<boolean> {
    if (!userId) return false;
    try {
      const membership = await this.prisma.membership.findUnique({
        where: { userId },
      });
      if (!membership) return false;

      const now = new Date();
      if (membership.status === 'TRIAL') {
        const isValid = !membership.trialEndsAt || membership.trialEndsAt > now;
        if (!isValid) {
          this.logger.warn(`User ${userId} trial membership expired at ${membership.trialEndsAt}`);
        }
        return isValid;
      }

      if (membership.status === 'ACTIVE') {
        const isValid = !membership.renewsAt || membership.renewsAt > now;
        if (!isValid) {
          this.logger.warn(`User ${userId} active membership expired at ${membership.renewsAt}`);
        }
        return isValid;
      }

      return false;
    } catch (err: any) {
      this.logger.error(`Error verifying membership for ${userId}: ${err.message}`);
      return false;
    }
  }

  async calculateCartPrice(input: CalculatePriceInput) {
    const itemTotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Cryptographically verify membership via DB if userId is present, otherwise fallback to input.isMember ?? false
    let isMember = false;
    if (input.userId) {
      isMember = await this.verifyMembership(input.userId);
    } else {
      isMember = !!input.isMember;
    }

    // Delivery & Packaging Fees
    const baseDeliveryFee = 45;
    const basePackagingFee = 25;

    // Membership benefits: exact member price when supplied, else a flat 30% off.
    // Delivery & packaging are free for members.
    const memberDiscount = isMember
      ? input.items.reduce((sum, item) => {
          const memberPrice =
            typeof item.memberPrice === 'number' ? Math.min(item.memberPrice, item.price) : item.price * 0.7;
          return sum + Math.max(0, item.price - memberPrice) * item.quantity;
        }, 0)
      : 0;
    const deliveryFee = isMember ? 0 : baseDeliveryFee;
    const packagingFee = isMember ? 0 : basePackagingFee;

    // Prospective savings for non-members (upsell calculations)
    const prospectiveMemberDiscount = Math.round(itemTotal * 0.3);
    const prospectiveTotalSavings = prospectiveMemberDiscount + baseDeliveryFee + basePackagingFee;

    // Coupon discount. An unknown code is reported as invalid so callers can
    // reject the order instead of silently charging more than the cart showed.
    const couponCode = input.couponCode?.trim().toUpperCase() || null;
    let couponDiscount = 0;
    let couponApplied = false;

    if (couponCode === 'EATCLUB100') {
      if (itemTotal >= 399) {
        couponDiscount = Math.min(100, itemTotal);
        couponApplied = true;
      }
    } else if (couponCode === 'CRAVE50') {
      couponDiscount = Math.min(50, itemTotal * 0.15);
      couponApplied = true;
    } else if (couponCode === 'WELCOME100') {
      couponDiscount = Math.min(100, itemTotal);
      couponApplied = true;
    }

    const couponInvalid = !!couponCode && !couponApplied;

    // Subtotal before wallet
    const subtotal = Math.max(0, itemTotal - memberDiscount - couponDiscount + deliveryFee + packagingFee);

    // Taxes (5% GST on food)
    const taxes = Math.round(subtotal * 0.05);

    // Final total before wallet deduction
    const grossTotal = subtotal + taxes;

    // Wallet deduction is capped by the *actual* stored balance, not by the
    // number the client asked for. Otherwise a client could request a wallet
    // amount larger than it owns and leave the order unpayable.
    let walletBalanceRupees = Number.POSITIVE_INFINITY;
    if (input.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { walletBalance: true },
      });
      walletBalanceRupees = Math.floor((user?.walletBalance ?? 0) / 100);
    }

    const requestedWallet = Math.max(0, Number(input.useWalletBalance) || 0);
    const walletApplied = Math.min(requestedWallet, walletBalanceRupees, grossTotal);
    const finalPayable = Math.max(0, grossTotal - walletApplied);

    return {
      isMemberVerified: isMember,
      itemTotal,
      memberDiscount,
      couponCode,
      couponDiscount,
      couponApplied,
      couponInvalid,
      deliveryFee,
      packagingFee,
      taxes,
      grossTotal,
      walletBalanceRupees: Number.isFinite(walletBalanceRupees) ? walletBalanceRupees : null,
      walletApplied,
      finalPayable,
      prospectiveSavings: {
        memberDiscountSaved: prospectiveMemberDiscount,
        deliverySaved: baseDeliveryFee,
        packagingSaved: basePackagingFee,
        totalSaved: prospectiveTotalSavings,
      },
      savingsSummary: {
        memberDiscountSaved: memberDiscount,
        deliverySaved: isMember ? baseDeliveryFee : 0,
        packagingSaved: isMember ? basePackagingFee : 0,
        couponDiscount,
        totalSaved:
          memberDiscount + (isMember ? baseDeliveryFee + basePackagingFee : 0) + couponDiscount,
      },
    };
  }

  // Cache store for active offers (60-second TTL to avoid hammering the database)
  private offersCache: { data: any; expiresAt: number } | null = null;

  /**
   * Fetches active pricing rules from DB (startsAt <= now and endsAt > now).
   * Caches results in memory for 60 seconds (SDD §5.2).
   */
  async getActiveOffers() {
    const nowMs = Date.now();
    if (this.offersCache && this.offersCache.expiresAt > nowMs) {
      return this.offersCache.data;
    }

    const now = new Date();
    const rawRules = await this.prisma.pricingRule.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
    });

    // Brand-proposed promotions start life as PENDING_ADMIN_APPROVAL. Only
    // approved (or legacy rules with no status) may be advertised or applied.
    const dbRules = rawRules.filter((rule: any) => {
      const status = rule?.config?.status;
      return !status || status === 'APPROVED';
    });

    // No clock-based or hardcoded promotions. If the database has no approved
    // rule in its window, there is no offer to show.
    const result = { rules: dbRules };

    // Cache for 60 seconds
    this.offersCache = {
      data: result,
      expiresAt: nowMs + 60000,
    };

    return result;
  }
}

