import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import Redis from 'ioredis';

const OTP_TTL_SECONDS = 10 * 60; // 10 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {
    // Connect to Redis — OTPs survive server restarts/hot-reloads
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
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

  async verifyOtp(email: string, code: string) {
    const cleanEmail = email.trim().toLowerCase();

    // Dev magic bypass — requires BOTH a development environment and an explicit opt-in.
    if (this.isDevOtpBypassEnabled() && code === '123456') {
      this.logger.log(`🔓 Dev bypass used for ${cleanEmail}`);
      return this.upsertUserAndSign(cleanEmail);
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

    return this.upsertUserAndSign(cleanEmail);
  }

  private async upsertUserAndSign(email: string) {
    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { membership: true, addresses: true },
    });

    if (user?.isBlocked) {
      throw new ForbiddenException('This account has been blocked. Contact support.');
    }

    if (!user) {
      const WELCOME_BONUS_PAISE = 10000; // ₹100

      // Create the user and the bonus ledger entry together, and seed the balance
      // in the same write. Previously the ledger got a ₹100 row while
      // User.walletBalance stayed at 0, so Profile and Checkout disagreed.
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            name: email.split('@')[0],
            phone: `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`,
            referralCode: `REF-${Math.floor(100000 + Math.random() * 900000)}`,
            walletBalance: WELCOME_BONUS_PAISE,
          },
          include: { membership: true, addresses: true },
        });

        await tx.walletTransaction.create({
          data: {
            userId: created.id,
            amountInPaise: WELCOME_BONUS_PAISE,
            reason: 'WELCOME_BONUS',
          },
        });

        return created;
      });

      // SDD §7.2: Auto-enroll new users in a 30-day Free Trial membership.
      const trialPlan = await this.prisma.membershipPlan.findFirst({
        where: { name: { contains: 'Trial' } },
      });
      const planId = trialPlan?.id || 'STANDARD_TRIAL';

      await this.prisma.membership.create({
        data: {
          userId: user.id,
          planId,
          status: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      this.logger.log(`👤 New user created: ${email} — 30-day Free Trial membership activated`);
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

    return { accessToken, user };
  }
}
