import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private otpStore = new Map<string, { code: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async requestOtp(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

    this.otpStore.set(cleanEmail, { code, expiresAt });
    this.logger.log(`🔑 Demo OTP generated for ${cleanEmail}: [ ${code} ]`);

    // Dispatch real HTML email via Resend
    await this.notificationsService.sendEmailOtp(cleanEmail, code).catch((err) => {
      this.logger.warn(`Resend email trigger warning: ${err.message}`);
    });

    return {
      success: true,
      message: `OTP sent to ${cleanEmail}`,
      demoOtp: process.env.NODE_ENV === 'development' ? code : undefined,
    };
  }

  async verifyOtp(email: string, code: string) {
    const cleanEmail = email.trim().toLowerCase();
    const record = this.otpStore.get(cleanEmail);

    if (!record || record.code !== code || Date.now() > record.expiresAt) {
      if (process.env.NODE_ENV === 'development' && code === '123456') {
        // Demo override
      } else {
        throw new UnauthorizedException('Invalid or expired OTP code');
      }
    }

    this.otpStore.delete(cleanEmail);

    // Upsert customer user
    let user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { membership: true, addresses: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: cleanEmail,
          name: cleanEmail.split('@')[0],
          phone: `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`,
          referralCode: `REF-${Math.floor(100000 + Math.random() * 900000)}`,
        },
        include: { membership: true, addresses: true },
      });

      // Default wallet initialization
      await this.prisma.walletTransaction.create({
        data: {
          userId: user.id,
          amountInPaise: 10000, // ₹100 welcome bonus
          reason: 'WELCOME_BONUS',
        },
      });
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user,
    };
  }
}
