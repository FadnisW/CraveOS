import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RazorpayService } from '../../common/razorpay/razorpay.service';

export type MembershipPaymentMethod = 'WALLET' | 'RAZORPAY';

export interface PurchaseMembershipInput {
  planId?: string;
  planSlug?: string;
  paymentMethod?: string;
  idempotencyKey?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
  ) {}

  /**
   * Purchasable plans only. The free trial is granted at signup, not sold.
   */
  async listPlans() {
    const plans = await this.prisma.membershipPlan.findMany({
      where: { isActive: true, isTrial: false },
      orderBy: [{ sortOrder: 'asc' }, { priceInPaise: 'asc' }],
    });

    return plans.map((plan) => ({
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      durationDays: plan.durationDays,
      priceInPaise: plan.priceInPaise,
      priceRupees: plan.priceInPaise / 100,
      monthlyEquivalentRupees:
        Math.round((plan.priceInPaise / plan.durationDays) * 30) / 100,
      benefits: [
        'Member prices on every menu item',
        'Free delivery on every order',
        'No packaging fee',
      ],
    }));
  }

  async getMyMembership(userId: string) {
    const now = new Date();
    const membership = await this.prisma.membership.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const purchases = await this.prisma.membershipPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { plan: { select: { name: true, slug: true } } },
    });

    return {
      membership: membership
        ? {
            id: membership.id,
            planId: membership.planId,
            planName: membership.plan?.name || membership.planId,
            planSlug: membership.plan?.slug || null,
            status: membership.status,
            startedAt: membership.startedAt,
            endsAt: membership.endsAt,
            isActive:
              ['TRIAL', 'ACTIVE'].includes(membership.status) &&
              membership.endsAt > now,
            autoRenew: false,
          }
        : null,
      purchases: purchases.map((purchase) => ({
        id: purchase.id,
        planId: purchase.planId,
        planName: purchase.plan?.name || purchase.planId,
        status: purchase.status,
        amountInPaise: purchase.amountInPaise,
        amountRupees: purchase.amountInPaise / 100,
        paymentMethod: purchase.paymentMethod,
        startsAt: purchase.startsAt,
        endsAt: purchase.endsAt,
        createdAt: purchase.createdAt,
      })),
    };
  }

  async purchase(userId: string, input: PurchaseMembershipInput) {
    const paymentMethod = String(input?.paymentMethod || '')
      .trim()
      .toUpperCase() as MembershipPaymentMethod;

    if (!['WALLET', 'RAZORPAY'].includes(paymentMethod)) {
      throw new BadRequestException(
        'paymentMethod must be WALLET or RAZORPAY',
      );
    }

    const planKey = String(input?.planId || input?.planSlug || '').trim();
    if (!planKey) {
      throw new BadRequestException('planId or planSlug is required');
    }

    const idempotencyKey =
      String(input?.idempotencyKey || '').trim().slice(0, 128) || null;

    if (idempotencyKey) {
      const existing = await this.prisma.membershipPurchase.findUnique({
        where: { idempotencyKey },
        include: { plan: true },
      });
      if (existing) {
        if (existing.userId !== userId) {
          throw new ForbiddenException(
            'This idempotency key belongs to another account',
          );
        }
        return this.serializeExistingPurchase(existing);
      }
    }

    const plan = await this.prisma.membershipPlan.findFirst({
      where: {
        OR: [{ id: planKey }, { slug: planKey.toLowerCase() }],
        isActive: true,
        isTrial: false,
      },
    });

    if (!plan) {
      throw new NotFoundException('Membership plan not found');
    }
    if (plan.priceInPaise <= 0) {
      throw new BadRequestException(
        'This plan has no payable amount. Use the free trial instead.',
      );
    }

    if (paymentMethod === 'WALLET') {
      return this.purchaseWithWallet(userId, plan, idempotencyKey);
    }

    return this.purchaseWithRazorpay(userId, plan, idempotencyKey);
  }

  private async purchaseWithWallet(
    userId: string,
    plan: { id: string; name: string; durationDays: number; priceInPaise: number },
    idempotencyKey: string | null,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.membershipPurchase.findUnique({
          where: { idempotencyKey },
          include: { plan: true },
        });
        if (existing) {
          return { purchase: existing, membership: null, alreadyProcessed: true };
        }
      }

      await tx.$executeRaw`SELECT "walletBalance" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true },
      });
      if (!user) throw new NotFoundException('User not found');

      if (user.walletBalance < plan.priceInPaise) {
        throw new ConflictException(
          `Insufficient wallet balance. This plan costs ₹${
            plan.priceInPaise / 100
          } and your wallet has ₹${user.walletBalance / 100}.`,
        );
      }

      const now = new Date();
      const activation = await this.activateMembership(tx, userId, plan, now);

      const purchase = await tx.membershipPurchase.create({
        data: {
          userId,
          planId: plan.id,
          idempotencyKey,
          status: 'SUCCESS',
          amountInPaise: plan.priceInPaise,
          paymentMethod: 'WALLET',
          startsAt: activation.benefitStart,
          endsAt: activation.benefitEnd,
        },
        include: { plan: true },
      });

      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { decrement: plan.priceInPaise } },
      });

      await tx.walletTransaction.create({
        data: {
          userId,
          amountInPaise: -plan.priceInPaise,
          reason: 'MEMBERSHIP_PURCHASE',
          referenceType: 'MEMBERSHIP_PURCHASE',
          referenceId: purchase.id,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'MEMBERSHIP_PURCHASED',
          actorId: userId,
          recordId: purchase.id,
          diff: {
            planId: plan.id,
            amountInPaise: plan.priceInPaise,
            paymentMethod: 'WALLET',
            startsAt: activation.benefitStart,
            endsAt: activation.benefitEnd,
            renewal: activation.renewing,
          },
        },
      });

      return {
        purchase,
        membership: activation.membership,
        alreadyProcessed: false,
      };
    });

    return {
      purchaseId: result.purchase.id,
      status: result.purchase.status,
      alreadyProcessed: result.alreadyProcessed,
      amountInPaise: result.purchase.amountInPaise,
      paymentMethod: 'WALLET',
      razorpay: null,
      membership: result.membership,
    };
  }

  private async purchaseWithRazorpay(
    userId: string,
    plan: { id: string; name: string; durationDays: number; priceInPaise: number },
    idempotencyKey: string | null,
  ) {
    if (!this.razorpay.isConfigured) {
      throw new InternalServerErrorException(
        'Payment gateway is not configured',
      );
    }

    let purchase: any;
    try {
      purchase = await this.prisma.membershipPurchase.create({
        data: {
          userId,
          planId: plan.id,
          idempotencyKey,
          status: 'INITIATED',
          amountInPaise: plan.priceInPaise,
          paymentMethod: 'RAZORPAY',
        },
        include: { plan: true },
      });
    } catch (error: any) {
      if (error?.code === 'P2002' && idempotencyKey) {
        const existing = await this.prisma.membershipPurchase.findUnique({
          where: { idempotencyKey },
          include: { plan: true },
        });
        if (existing) return this.serializeExistingPurchase(existing);
      }
      throw error;
    }

    try {
      const gatewayOrder = await this.razorpay.createOrder({
        amountInPaise: plan.priceInPaise,
        receipt: `membership_${purchase.id}`.slice(0, 40),
        notes: {
          purchaseId: purchase.id,
          userId,
          planId: plan.id,
          kind: 'MEMBERSHIP',
        },
      });

      const updated = await this.prisma.membershipPurchase.update({
        where: { id: purchase.id },
        data: { gatewayOrderId: gatewayOrder.id },
        include: { plan: true },
      });

      return {
        purchaseId: updated.id,
        status: updated.status,
        alreadyProcessed: false,
        amountInPaise: updated.amountInPaise,
        paymentMethod: 'RAZORPAY',
        razorpay: {
          orderId: gatewayOrder.id,
          amount: updated.amountInPaise,
          currency: 'INR',
          key: this.razorpay.keyId,
        },
        membership: null,
      };
    } catch (error: any) {
      await this.prisma.membershipPurchase.update({
        where: { id: purchase.id },
        data: { status: 'FAILED' },
      });
      this.logger.error(
        `Failed to create Razorpay order for membership purchase ${purchase.id}:`,
        error,
      );
      throw new InternalServerErrorException(
        error?.error?.description ||
          error?.message ||
          'Could not start the payment',
      );
    }
  }

  private serializeExistingPurchase(purchase: any) {
    if (purchase.status === 'SUCCESS') {
      return {
        purchaseId: purchase.id,
        status: purchase.status,
        alreadyProcessed: true,
        amountInPaise: purchase.amountInPaise,
        paymentMethod: purchase.paymentMethod,
        razorpay: null,
        membership: null,
      };
    }

    if (purchase.status === 'FAILED') {
      throw new ConflictException(
        'This purchase attempt failed. Start a new purchase to try again.',
      );
    }

    if (purchase.status === 'REFUNDED') {
      throw new ConflictException('This purchase has been refunded.');
    }

    if (!purchase.gatewayOrderId) {
      throw new ConflictException(
        'This purchase is still starting. Please retry in a moment.',
      );
    }

    return {
      purchaseId: purchase.id,
      status: purchase.status,
      alreadyProcessed: false,
      amountInPaise: purchase.amountInPaise,
      paymentMethod: purchase.paymentMethod,
      razorpay: {
        orderId: purchase.gatewayOrderId,
        amount: purchase.amountInPaise,
        currency: 'INR',
        key: this.razorpay.keyId,
      },
      membership: null,
    };
  }

  async verifyPurchase(
    userId: string,
    input: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    },
  ) {
    const {
      razorpay_order_id: gatewayOrderId,
      razorpay_payment_id: gatewayPaymentId,
      razorpay_signature: signature,
    } = input || {};

    if (!gatewayOrderId || !gatewayPaymentId || !signature) {
      throw new BadRequestException(
        'razorpay_order_id, razorpay_payment_id and razorpay_signature are required',
      );
    }

    const purchase = await this.prisma.membershipPurchase.findUnique({
      where: { gatewayOrderId },
      include: { plan: true },
    });

    if (!purchase) {
      throw new NotFoundException(
        'Unknown membership purchase for this gateway order',
      );
    }
    if (purchase.userId !== userId) {
      throw new ForbiddenException(
        'You can only verify your own membership purchases',
      );
    }

    if (
      !this.razorpay.verifyPaymentSignature(
        gatewayOrderId,
        gatewayPaymentId,
        signature,
      )
    ) {
      this.logger.error(
        `Invalid Razorpay signature for membership gateway order ${gatewayOrderId}`,
      );
      throw new BadRequestException('Invalid payment signature');
    }

    const result = await this.markPurchaseSuccess(
      gatewayOrderId,
      gatewayPaymentId,
    );

    return {
      status: 'SUCCESS',
      purchaseId: purchase.id,
      alreadyProcessed: !!result?.alreadyProcessed,
      membership: result?.membership || null,
    };
  }

  /**
   * Idempotent settlement used by both the Razorpay webhook and the client
   * verification endpoint.
   */
  async markPurchaseSuccess(
    gatewayOrderId: string,
    gatewayPaymentId?: string,
    capturedAmountPaise?: number,
    currency?: string,
  ) {
    const purchase = await this.prisma.membershipPurchase.findUnique({
      where: { gatewayOrderId },
      include: { plan: true },
    });

    if (!purchase) {
      return null;
    }

    if (currency && currency.toUpperCase() !== 'INR') {
      this.logger.error(
        `Rejected membership payment ${gatewayOrderId}: currency ${currency} is not INR`,
      );
      return { rejected: true, reason: 'CURRENCY_MISMATCH' };
    }

    if (
      typeof capturedAmountPaise === 'number' &&
      Number.isFinite(capturedAmountPaise) &&
      capturedAmountPaise !== purchase.amountInPaise
    ) {
      this.logger.error(
        `Rejected membership payment ${gatewayOrderId}: captured ${capturedAmountPaise} paise but expected ${purchase.amountInPaise}`,
      );
      return { rejected: true, reason: 'AMOUNT_MISMATCH' };
    }

    if (purchase.status === 'SUCCESS') {
      return { alreadyProcessed: true, purchaseId: purchase.id };
    }
    if (purchase.status === 'REFUNDED') {
      return { rejected: true, reason: 'PURCHASE_REFUNDED' };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT "id" FROM "membership_purchases" WHERE "id" = ${purchase.id} FOR UPDATE`;

      const fresh = await tx.membershipPurchase.findUnique({
        where: { id: purchase.id },
        include: { plan: true },
      });

      if (!fresh || fresh.status === 'SUCCESS') {
        return { alreadyProcessed: true, membership: null };
      }
      if (fresh.status === 'REFUNDED') {
        return { alreadyProcessed: false, membership: null };
      }

      const now = new Date();
      const activation = await this.activateMembership(
        tx,
        fresh.userId,
        fresh.plan,
        now,
      );

      await tx.membershipPurchase.update({
        where: { id: fresh.id },
        data: {
          status: 'SUCCESS',
          gatewayPaymentId: gatewayPaymentId || fresh.gatewayPaymentId,
          startsAt: activation.benefitStart,
          endsAt: activation.benefitEnd,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'MEMBERSHIP_PURCHASED',
          actorId: fresh.userId,
          recordId: fresh.id,
          diff: {
            planId: fresh.planId,
            amountInPaise: fresh.amountInPaise,
            paymentMethod: 'RAZORPAY',
            gatewayOrderId,
            gatewayPaymentId,
            startsAt: activation.benefitStart,
            endsAt: activation.benefitEnd,
            renewal: activation.renewing,
          },
        },
      });

      return {
        alreadyProcessed: false,
        membership: activation.membership,
      };
    });

    this.logger.log(
      `Membership purchase ${purchase.id} settled via Razorpay (${gatewayOrderId})`,
    );

    return {
      alreadyProcessed: result.alreadyProcessed,
      purchaseId: purchase.id,
      membership: result.membership,
    };
  }

  async markPurchaseFailed(gatewayOrderId: string, reason?: string) {
    const purchase = await this.prisma.membershipPurchase.findUnique({
      where: { gatewayOrderId },
    });

    if (!purchase || ['SUCCESS', 'REFUNDED'].includes(purchase.status)) {
      return null;
    }

    await this.prisma.membershipPurchase.update({
      where: { id: purchase.id },
      data: { status: 'FAILED' },
    });

    this.logger.warn(
      `Membership purchase ${purchase.id} failed (${gatewayOrderId}): ${
        reason || 'gateway reported failure'
      }`,
    );

    return { purchaseId: purchase.id };
  }

  /**
   * Applies a paid plan to the customer's single membership row.
   *
   * Renewals extend the current paid expiry. Buying during a trial starts the
   * paid plan immediately, which is the policy shown on the membership screen.
   */
  private async activateMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    plan: { id: string; name: string; durationDays: number },
    now: Date,
  ) {
    await tx.$executeRaw`SELECT "id" FROM "memberships" WHERE "userId" = ${userId} FOR UPDATE`;

    const existing = await tx.membership.findUnique({ where: { userId } });

    const renewing =
      !!existing && existing.status === 'ACTIVE' && existing.endsAt > now;
    const benefitStart = renewing ? existing!.endsAt : now;
    const benefitEnd = addDays(benefitStart, plan.durationDays);

    const membership = await tx.membership.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        startedAt: renewing ? existing!.startedAt : now,
        endsAt: benefitEnd,
        autoRenew: false,
        cancelledAt: null,
      },
      create: {
        userId,
        planId: plan.id,
        status: 'ACTIVE',
        startedAt: now,
        endsAt: benefitEnd,
        autoRenew: false,
      },
      include: { plan: true },
    });

    return { membership, benefitStart, benefitEnd, renewing };
  }
}
