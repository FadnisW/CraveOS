import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import { TokenDenylistService } from '../../common/auth/token-denylist.service';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';
import Redis from 'ioredis';
import { redisUrl } from '../../common/config/env.validation';

const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_REQUEST_WINDOW_SECONDS = 15 * 60;
const OTP_REQUEST_PER_EMAIL = 5;
const OTP_REQUEST_PER_IP = 20;
const OTP_FAILURE_WINDOW_SECONDS = 15 * 60;
const OTP_MAX_FAILURES = 5;
const WS_TICKET_TTL_SECONDS = 60;
const TRIAL_DAYS = 30;

/**
 * The policy text a customer is agreeing to. Bump this whenever Terms or
 * Privacy change materially; the accepted version is stored per account so
 * support can prove which text was shown.
 */
export const LEGAL_POLICY_VERSION = '2026-10-27';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
    private readonly referralsService: ReferralsService,
    private readonly tokenDenylist: TokenDenylistService,
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

  /**
   * Emails are the account key, so reject malformed input before it can create
   * a Redis key or a database row. Lower-casing keeps `A@x.com` and `a@x.com`
   * the same account.
   */
  private normaliseEmail(email: string) {
    const clean = String(email || '').trim().toLowerCase();

    if (!clean || clean.length > 254 || !EMAIL_PATTERN.test(clean)) {
      throw new BadRequestException('Enter a valid email address.');
    }

    return clean;
  }

  private async incrementWithTtl(key: string, windowSeconds: number) {
    // INCR and EXPIRE must be atomic. Two separate commands can leave a
    // counter with no TTL if the process dies between them, locking an email
    // out permanently.
    const count = await this.redis.eval(
      "local c = redis.call('INCR', KEYS[1]) if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end return c",
      1,
      key,
      windowSeconds,
    );

    return Number(count);
  }

  private tooManyRequests(message: string) {
    return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
  }

  private async enforceRateLimit(
    bucket: string,
    limit: number,
    windowSeconds: number,
    message: string,
  ) {
    const key = `ratelimit:${bucket}`;
    const count = await this.incrementWithTtl(key, windowSeconds);

    if (count > limit) {
      const ttl = await this.redis.ttl(key);
      throw this.tooManyRequests(
        `${message} Try again in ${Math.max(1, ttl)} seconds.`,
      );
    }
  }

  async requestOtp(email: string, ip?: string) {
    const cleanEmail = this.normaliseEmail(email);
    const clientIp = String(ip || 'unknown').trim() || 'unknown';

    // Rate limits are checked before a code is generated so a flood cannot
    // overwrite a legitimate customer's pending code.
    await this.enforceRateLimit(
      `otp:request:email:${cleanEmail}`,
      OTP_REQUEST_PER_EMAIL,
      OTP_REQUEST_WINDOW_SECONDS,
      'Too many verification codes requested for this email.',
    );
    await this.enforceRateLimit(
      `otp:request:ip:${clientIp}`,
      OTP_REQUEST_PER_IP,
      OTP_REQUEST_WINDOW_SECONDS,
      'Too many verification codes requested from this network.',
    );

    const cooldownKey = `otp:cooldown:${cleanEmail}`;
    const cooldown = await this.redis.set(
      cooldownKey,
      '1',
      'EX',
      OTP_RESEND_COOLDOWN_SECONDS,
      'NX',
    );

    if (cooldown !== 'OK') {
      throw this.tooManyRequests(
        `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code.`,
      );
    }

    const code = crypto.randomInt(100000, 1000000).toString();

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

  async verifyOtp(
    email: string,
    code: string,
    referralCode?: string,
    acceptedLegal?: boolean,
  ) {
    const cleanEmail = this.normaliseEmail(email);
    const cleanCode = String(code || '').trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      throw new BadRequestException('Enter the 6-digit verification code.');
    }

    // A stolen email address should not be enough to brute-force a 6-digit
    // code: five wrong attempts locks verification for fifteen minutes.
    const failureKey = `otp:fail:${cleanEmail}`;
    const failures = Number(await this.redis.get(failureKey)) || 0;

    if (failures >= OTP_MAX_FAILURES) {
      throw this.tooManyRequests(
        'Too many incorrect codes. Request a new code in 15 minutes.',
      );
    }

    // Dev magic bypass — requires BOTH a development environment and an explicit opt-in.
    if (this.isDevOtpBypassEnabled() && cleanCode === '123456') {
      await this.redis.del(failureKey);
      this.logger.log(`🔓 Dev bypass used for ${cleanEmail}`);
      return this.upsertUserAndSign(cleanEmail, referralCode, acceptedLegal);
    }

    // Fetch OTP from Redis
    const storedCode = await this.redis.get(this.otpKey(cleanEmail));

    this.logger.log(`Verifying OTP for ${cleanEmail}`);

    if (!storedCode || storedCode !== cleanCode) {
      await this.incrementWithTtl(failureKey, OTP_FAILURE_WINDOW_SECONDS);

      throw new UnauthorizedException(
        !storedCode
          ? 'OTP has expired — please request a new one'
          : 'Incorrect OTP code — please try again',
      );
    }

    // Delete OTP so it can only be used once
    await this.redis.del(this.otpKey(cleanEmail));
    await this.redis.del(failureKey);
    this.logger.log(`✅ OTP verified for ${cleanEmail}`);

    return this.upsertUserAndSign(cleanEmail, referralCode, acceptedLegal);
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

  /**
   * Hydration endpoint for the storefront.
   *
   * Returns `authenticated: false` instead of 401 when there is no token or the
   * token is no longer valid, so an anonymous page load does not look like an
   * error in the browser console or the access logs. It is deliberately
   * `@Public()` and parses the Bearer header itself: the global guard would
   * otherwise reject the request before this method could answer honestly.
   */
  async getSession(authorization?: string) {
    const anonymous = { authenticated: false, role: null, user: null };
    const token = this.extractBearer(authorization);

    if (!token) return anonymous;

    let claims: any;
    try {
      claims = this.jwtService.verify(token);
    } catch {
      return anonymous;
    }

    if (!claims?.sub || claims.scope === 'ws') return anonymous;

    if (await this.tokenDenylist.isRevoked(claims.jti)) {
      return anonymous;
    }

    if (claims.role === 'RIDER') {
      const rider = await this.prisma.rider.findUnique({
        where: { id: claims.sub },
        include: { currentHub: true },
      });

      if (
        !rider ||
        rider.status === 'SUSPENDED' ||
        rider.status === 'REJECTED'
      ) {
        return anonymous;
      }

      return { authenticated: true, role: 'RIDER', user: rider };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      include: { membership: { include: { plan: true } }, addresses: true },
    });

    if (!user || user.isBlocked) return anonymous;

    return {
      authenticated: true,
      role: user.role || 'CUSTOMER',
      user,
    };
  }

  /**
   * Real logout. Clearing the cookie on the client is not enough because a
   * copied JWT stays valid until it expires; the token id is revoked in Redis
   * for exactly its remaining lifetime.
   */
  async logout(actor: AuthenticatedActor) {
    if (!actor?.jti) {
      this.logger.warn(
        'Logout requested for a token without jti. Rotate JWT_SECRET to invalidate pre-Phase-3 tokens.',
      );
      return { success: true, revoked: false };
    }

    await this.tokenDenylist.revoke(actor.jti, actor.exp);
    return { success: true, revoked: true };
  }

  /**
   * A socket needs to reconnect for hours, but a long-lived token in a
   * WebSocket handshake is hard to revoke. The browser fetches a 60-second
   * ticket per connection attempt instead; the ticket is marked `scope: 'ws'`
   * so the HTTP guard refuses it everywhere else.
   */
  async issueWsTicket(actor: AuthenticatedActor) {
    const ticket = this.jwtService.sign(
      {
        sub: actor.sub,
        role: actor.role,
        adminSubRole: actor.adminSubRole ?? null,
        scopedHubId: actor.scopedHubId ?? null,
        scopedBrandId: actor.scopedBrandId ?? null,
        scope: 'ws',
        jti: crypto.randomUUID(),
      },
      { expiresIn: WS_TICKET_TTL_SECONDS },
    );

    return { ticket, expiresIn: WS_TICKET_TTL_SECONDS };
  }

  private extractBearer(header?: string) {
    if (!header) return null;
    const [scheme, ...rest] = header.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer') return null;
    const token = rest.join('');
    return token || null;
  }

  private async upsertUserAndSign(
    email: string,
    referralCode?: string,
    acceptedLegal?: boolean,
  ) {
    let user: any = await this.prisma.user.findUnique({
      where: { email },
      include: { membership: { include: { plan: true } }, addresses: true },
    });

    if (user?.isBlocked) {
      throw new ForbiddenException('This account has been blocked. Contact support.');
    }

    // An account is a contract. Creating one without the customer ticking the
    // Terms + Privacy checkbox would make the published policies untrue.
    if (!user && acceptedLegal !== true) {
      throw new BadRequestException(
        'You must accept the Terms of Service and Privacy Policy to create an account.',
      );
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

      const consentedAt = new Date();

      const created = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            name: email.split('@')[0],
            referralCode: await this.generateReferralCode(tx),
            // Record the affirmative consent, not just the fact that signup
            // happened: the timestamp and policy version are the audit trail.
            termsAcceptedAt: consentedAt,
            termsVersion: LEGAL_POLICY_VERSION,
            privacyAcceptedAt: consentedAt,
            privacyVersion: LEGAL_POLICY_VERSION,
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
    } else if (acceptedLegal === true && (!user.termsAcceptedAt || !user.privacyAcceptedAt)) {
      // Accounts created before consent capture existed get the same audit
      // trail the next time their owner affirmatively accepts the policies.
      const consentedAt = new Date();
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          termsAcceptedAt: user.termsAcceptedAt ?? consentedAt,
          termsVersion: user.termsVersion ?? LEGAL_POLICY_VERSION,
          privacyAcceptedAt: user.privacyAcceptedAt ?? consentedAt,
          privacyVersion: user.privacyVersion ?? LEGAL_POLICY_VERSION,
        },
        include: { membership: { include: { plan: true } }, addresses: true },
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role || 'CUSTOMER',
      adminSubRole: user.adminSubRole || null,
      scopedHubId: user.scopedHubId || null,
      scopedBrandId: user.scopedBrandId || null,
      jti: crypto.randomUUID(),
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
