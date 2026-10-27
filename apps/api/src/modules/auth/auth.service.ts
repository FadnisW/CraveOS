import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import Redis from 'ioredis';
import { redisUrl } from '../../common/config/env.validation';

const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
const TRIAL_DAYS = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
    private readonly referralsService: ReferralsService,
  ) {
    // Connect to Redis — OTPs survive server restarts/hot-reloads.
    // No localhost fallback: REDIS_URL is required and validated at startup.
    this.redis = new Redis(redisUrl());
    this.redis.on('connect', () => this.logger.log('🔴 Redis connected for OTP store'));
    this.redis.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
  }

  private otpKey(email: string) {
    return `otp:${email}`;
  }

  /** The dev OTP bypass needs an explicit second opt-in, not just NODE_ENV. */
  private isDevOtpBypassEnabled() {
    return (
      process.env.NODE_ENV === 'development' && process.env.DEV_OTP_BYPASS === 'true'
    );
  }

  async requestOtp(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with TTL — survives hot-reloads. Never log the code.
    await this.redis.set(this.otpKey(cleanEmail), code, 'EX', OTP_TTL_SECONDS);
    this.logger.log(`OTP generated for ${cleanEmail} (expires in ${OTP_TTL_SECONDS}s)`);

    const delivery = await this.notificationsService.sendEmailOtp(cleanEmail, code);

    if (!delivery.success && !this.isDevOtpBypassEnabled()) {
      // Do not leave a code in Redis that the customer never received.
      await this.redis.del(this.otpKey(cleanEmail));
      throw new ServiceUnavailableException(
        'We could not send the verification email. Please try again in a moment.',
      );
    }

    if (!delivery.success) {
      this.logger.warn(
        `OTP email delivery failed for ${cleanEmail}; DEV_OTP_BYPASS is active so the code is returned to the client.`,
      );
    }

    return {
      success: true,
      message: `OTP sent to ${cleanEmail}`,
      // Return OTP in dev mode so the frontend can show it without email
      demoOtp: this.isDevOtpBypassEnabled() ? code : undefined,
    };
  }

  async verifyOtp(email: string, code: string, referralCode?: string) {
    const cleanEmail = email.trim().toLowerCase();

    // Dev magic bypass — requires BOTH a development environment and an explicit opt-in.
    if (this.isDevOtpBypassEnabled() && code === '123456') {
      this.logger.log(`🔓 Dev bypass used for ${cleanEmail}`);
      return this.upsertUserAndSign(cleanEmail, referralCode);
    }

    // Fetch OTP from Redis
    const storedCode = await this.redis.get(this.otpKey(cleanEmail));

    this.logger.log(`Verifying OTP for ${cleanEmail}`);

    if (!storedCode || storedCode !== code) {
      throw new UnauthorizedException(
        !storedCode
          ? 'OTP has expired — please request a new one'
          : 'Incorrect OTP code — please try again',
      );
    }

    // Delete OTP so it can only be used once
    await this.redis.del(this.otpKey(cleanEmail));
    this.logger.log(`✅ OTP verified for ${cleanEmail}`);

    return this.upsertUserAndSign(cleanEmail, referralCode);
  }

  /**
   * Returns the signed-in account with the relations the storefront renders.
   * Never returns password/token material — there is none on User.
   */
  async getMe(userId: string) {
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { membership: { include: { plan: true } }, addresses: true },
    });

    if (!user) {
      throw new UnauthorizedException('This account no longer exists');
    }
    if (user.isBlocked) {
      throw new ForbiddenException(
        'This account has been blocked. Contact support.',
      );
    }

    return { user };
  }

  private async upsertUserAndSign(email: string, referralCode?: string) {
    let user: any = await this.prisma.user.findUnique({
      where: { email },
      include: { membership: { include: { plan: true } }, addresses: true },
    });

    if (user?.isBlocked) {
      throw new ForbiddenException('This account has been blocked. Contact support.');
    }

    let referralApplied = false;

    if (!user) {
      const trialPlan = await this.prisma.membershipPlan.findFirst({
        where: { isTrial: true, isActive: true },
        orderBy: { sortOrder: 'asc' },
      });

      if (!trialPlan) {
        // The trial plan is created by the Phase 2 migration. Failing loudly is
        // better than creating an account with a dangling plan id.
        throw new InternalServerErrorException(
          'The free trial is not configured. Contact support.',
        );
      }

      const created = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            name: email.split('@')[0],
            referralCode: await this.generateReferralCode(tx),
            // No welcome wallet cash: it was farmable. New customers get the
            // WELCOME100 promotion, which is only redeemable on a real order.
          },
          include: {
            membership: { include: { plan: true } },
            addresses: true,
          },
        });

        await tx.membership.create({
          data: {
            userId: newUser.id,
            planId: trialPlan.id,
            status: 'TRIAL',
            startedAt: new Date(),
            endsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          },
        });

        const referral = await this.referralsService.acceptReferral(
          tx,
          newUser.id,
          referralCode,
        );

        const hydrated = await tx.user.findUnique({
          where: { id: newUser.id },
          include: {
            membership: { include: { plan: true } },
            addresses: true,
          },
        });

        return { user: hydrated || newUser, referralApplied: referral.applied };
      });

      user = created.user;
      referralApplied = created.referralApplied;

      this.logger.log(
        `👤 New user created: ${email} — ${TRIAL_DAYS}-day free trial activated${
          referralApplied ? ' with referral' : ''
        }`,
      );
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role || 'CUSTOMER',
      adminSubRole: user.adminSubRole || null,
      scopedHubId: user.scopedHubId || null,
      scopedBrandId: user.scopedBrandId || null,
    };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken, user, referralApplied };
  }

  private async generateReferralCode(tx: any): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = `REF-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
      const existing = await tx.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }

    throw new InternalServerErrorException(
      'Could not allocate a referral code. Please retry.',
    );
  }
}
