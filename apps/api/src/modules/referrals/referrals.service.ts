import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Money decisions agreed for launch. Amounts are paise. */
export const REFERRER_REWARD_PAISE = 10000; // ₹100
export const REFEREE_REWARD_PAISE = 5000; // ₹50
export const MAX_REWARDED_REFERRALS_PER_REFERRER = 20;

type ReferralDb = Prisma.TransactionClient | PrismaService;

export interface AcceptReferralResult {
  applied: boolean;
  reason?:
    | 'NO_CODE'
    | 'INVALID_CODE'
    | 'REFERRER_BLOCKED'
    | 'REFERRER_NOT_ELIGIBLE'
    | 'ALREADY_REFERRED';
}

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a referral at signup.
   *
   * A code is only accepted when the referrer is a real customer who has
   * already received at least one delivered order. This stops brand-new
   * accounts from referring each other in a loop.
   */
  async acceptReferral(
    db: ReferralDb,
    refereeId: string,
    rawCode?: string,
  ): Promise<AcceptReferralResult> {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) return { applied: false, reason: 'NO_CODE' };

    const referrer = await db.user.findUnique({
      where: { referralCode: code },
      select: { id: true, isBlocked: true },
    });

    if (!referrer || referrer.id === refereeId) {
      return { applied: false, reason: 'INVALID_CODE' };
    }
    if (referrer.isBlocked) {
      return { applied: false, reason: 'REFERRER_BLOCKED' };
    }

    const deliveredOrders = await db.order.count({
      where: { userId: referrer.id, status: 'DELIVERED' },
    });
    if (deliveredOrders === 0) {
      return { applied: false, reason: 'REFERRER_NOT_ELIGIBLE' };
    }

    const existing = await db.referral.findUnique({
      where: { refereeId },
      select: { id: true },
    });
    if (existing) {
      return { applied: false, reason: 'ALREADY_REFERRED' };
    }

    await db.referral.create({
      data: {
        referrerId: referrer.id,
        refereeId,
        code,
        rewardPaise: REFERRER_REWARD_PAISE,
        refereeRewardPaise: REFEREE_REWARD_PAISE,
      },
    });

    await db.user.update({
      where: { id: refereeId },
      data: { referredById: referrer.id },
    });

    this.logger.log(`Referral ${code} recorded for referee ${refereeId}`);
    return { applied: true };
  }

  /**
   * Pays both sides once the referee's first order is delivered.
   *
   * Must be called inside the delivery transaction. The referrer cap only
   * limits the referrer's reward; the referee still receives their ₹50.
   */
  async qualifyReferral(
    tx: Prisma.TransactionClient,
    refereeId: string,
    orderId: string,
  ) {
    // Two concurrent deliveries for the same referee must not pay twice.
    await tx.$executeRaw`SELECT "id" FROM "referrals" WHERE "refereeId" = ${refereeId} FOR UPDATE`;

    const referral = await tx.referral.findUnique({
      where: { refereeId },
    });

    if (!referral || referral.status !== 'PENDING') {
      return null;
    }

    // This must be the referee's first delivered order. The order row has just
    // been marked DELIVERED inside the caller's transaction.
    const deliveredOrders = await tx.order.count({
      where: { userId: refereeId, status: 'DELIVERED' },
    });
    if (deliveredOrders !== 1) {
      return null;
    }

    const rewardedReferrals = await tx.referral.count({
      where: { referrerId: referral.referrerId, status: 'REWARDED' },
    });
    const referrerRewardPaise =
      rewardedReferrals < MAX_REWARDED_REFERRALS_PER_REFERRER
        ? referral.rewardPaise
        : 0;
    const refereeRewardPaise = referral.refereeRewardPaise;

    if (referrerRewardPaise > 0) {
      await tx.user.update({
        where: { id: referral.referrerId },
        data: { walletBalance: { increment: referrerRewardPaise } },
      });
      await tx.walletTransaction.create({
        data: {
          userId: referral.referrerId,
          amountInPaise: referrerRewardPaise,
          reason: 'REFERRAL_REWARD',
          referenceType: 'REFERRAL',
          referenceId: referral.id,
        },
      });
    }

    if (refereeRewardPaise > 0) {
      await tx.user.update({
        where: { id: referral.refereeId },
        data: { walletBalance: { increment: refereeRewardPaise } },
      });
      await tx.walletTransaction.create({
        data: {
          userId: referral.refereeId,
          amountInPaise: refereeRewardPaise,
          reason: 'REFERRAL_REWARD',
          referenceType: 'REFERRAL',
          referenceId: referral.id,
        },
      });
    }

    const now = new Date();
    const rewarded = await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: 'REWARDED',
        rewardPaise: referrerRewardPaise,
        qualifiedAt: now,
        rewardedAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        action: 'REFERRAL_REWARDED',
        actorId: referral.refereeId,
        recordId: referral.id,
        diff: {
          orderId,
          referrerId: referral.referrerId,
          refereeId: referral.refereeId,
          referrerRewardPaise,
          refereeRewardPaise,
          referrerCapReached:
            referrerRewardPaise < referral.rewardPaise,
        },
      },
    });

    this.logger.log(
      `Referral ${referral.id} rewarded after order ${orderId}: referrer ₹${
        referrerRewardPaise / 100
      }, referee ₹${refereeRewardPaise / 100}`,
    );

    return rewarded;
  }

  async getMyReferrals(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    if (!user) {
      return null;
    }

    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        referee: { select: { name: true, email: true, createdAt: true } },
      },
    });

    const rewarded = referrals.filter((r) => r.status === 'REWARDED');
    const earnedPaise = rewarded.reduce((sum, r) => sum + r.rewardPaise, 0);

    return {
      code: user.referralCode,
      reward: {
        referrerPaise: REFERRER_REWARD_PAISE,
        refereePaise: REFEREE_REWARD_PAISE,
        maxRewardedReferrals: MAX_REWARDED_REFERRALS_PER_REFERRER,
        earnedPaise,
        remainingRewardedSlots: Math.max(
          0,
          MAX_REWARDED_REFERRALS_PER_REFERRER - rewarded.length,
        ),
      },
      stats: {
        total: referrals.length,
        pending: referrals.filter((r) => r.status === 'PENDING').length,
        rewarded: rewarded.length,
        cancelled: referrals.filter((r) => r.status === 'CANCELLED').length,
      },
      referrals: referrals.map((referral) => ({
        id: referral.id,
        status: referral.status,
        rewardPaise: referral.rewardPaise,
        refereeRewardPaise: referral.refereeRewardPaise,
        qualifiedAt: referral.qualifiedAt,
        rewardedAt: referral.rewardedAt,
        createdAt: referral.createdAt,
        referee: {
          name: referral.referee.name,
          // Do not expose a full email address to the referrer.
          email: this.maskEmail(referral.referee.email),
          joinedAt: referral.referee.createdAt,
        },
      })),
    };
  }

  private maskEmail(email: string | null) {
    if (!email) return null;
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const visible = local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  }
}
