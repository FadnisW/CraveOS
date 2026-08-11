import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
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

  async requestOtp(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with TTL — survives hot-reloads
    await this.redis.set(this.otpKey(cleanEmail), code, 'EX', OTP_TTL_SECONDS);
    this.logger.log(`🔑 OTP generated for ${cleanEmail}: [ ${code} ] (expires in ${OTP_TTL_SECONDS}s)`);

    // Send email via Resend
    await this.notificationsService.sendEmailOtp(cleanEmail, code).catch((err) => {
      this.logger.warn(`Resend email trigger warning: ${err.message}`);
    });

    return {
      success: true,
      message: `OTP sent to ${cleanEmail}`,
      // Return OTP in dev mode so the frontend can show it without email
      demoOtp: process.env.NODE_ENV === 'development' ? code : undefined,
    };
  }

  async verifyOtp(email: string, code: string) {
    const cleanEmail = email.trim().toLowerCase();

    // Dev magic bypass — always works in development
    if (process.env.NODE_ENV === 'development' && code === '123456') {
      this.logger.log(`🔓 Dev bypass used for ${cleanEmail}`);
      return this.upsertUserAndSign(cleanEmail);
    }

    // Fetch OTP from Redis
    const storedCode = await this.redis.get(this.otpKey(cleanEmail));

    this.logger.log(`🔍 Verifying OTP for ${cleanEmail}: submitted="${code}" stored="${storedCode}"`);

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

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: email.split('@')[0],
          phone: `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`,
          referralCode: `REF-${Math.floor(100000 + Math.random() * 900000)}`,
        },
        include: { membership: true, addresses: true },
      });

      // ₹100 welcome bonus wallet credit
      await this.prisma.walletTransaction.create({
        data: {
          userId: user.id,
          amountInPaise: 10000,
          reason: 'WELCOME_BONUS',
        },
      });

      this.logger.log(`👤 New user created: ${email}`);
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken, user };
  }
}
