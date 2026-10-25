import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RiderStatus } from '@prisma/client';
import Redis from 'ioredis';

const RIDER_OTP_TTL_SECONDS = 10 * 60; // 10 minutes

@Injectable()
export class RidersService {
  private readonly logger = new Logger(RidersService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.redis.on('connect', () => this.logger.log('🔴 Redis connected for Rider OTP store'));
    this.redis.on('error', (err) => this.logger.warn(`Redis error in RidersService: ${err.message}`));
  }

  private otpKey(phone: string) {
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    return `otp:rider:${cleanPhone}`;
  }

  /** The dev OTP bypass needs an explicit second opt-in, not just NODE_ENV. */
  private isDevOtpBypassEnabled() {
    return (
      process.env.NODE_ENV === 'development' && process.env.DEV_OTP_BYPASS === 'true'
    );
  }

  /**
   * Request phone OTP for Rider registration/login
   */
  async registerRider(phone: string) {
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new BadRequestException('Invalid phone number format');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redis.set(this.otpKey(cleanPhone), code, 'EX', RIDER_OTP_TTL_SECONDS);

    this.logger.log(
      `🔑 Rider OTP generated for ${cleanPhone}: [ ${code} ] (expires in ${RIDER_OTP_TTL_SECONDS}s)`,
    );

    // Send SMS / Notification trigger
    await this.notificationsService
      .sendEmailOtp(cleanPhone + '@rider.eatclub.in', code)
      .catch((err) => {
        this.logger.warn(`Rider notification trigger warning: ${err.message}`);
      });

    return {
      success: true,
      message: `OTP sent to ${cleanPhone}`,
      demoOtp: this.isDevOtpBypassEnabled() ? code : undefined,
    };
  }

  /**
   * Verify Rider OTP, create or fetch Rider record, return JWT with role: 'RIDER'
   */
  async verifyRiderOtp(phone: string, code: string, name?: string, vehicleType?: string) {
    const cleanPhone = phone.trim().replace(/\s+/g, '');

    // Dev magic bypass — requires BOTH a development environment and an explicit opt-in,
    // so a misconfigured NODE_ENV cannot silently reopen a universal OTP.
    if (this.isDevOtpBypassEnabled() && code === '123456') {
      this.logger.log(`🔓 Dev bypass used for rider ${cleanPhone}`);
      return this.upsertRiderAndSign(cleanPhone, name, vehicleType);
    }

    const storedCode = await this.redis.get(this.otpKey(cleanPhone));
    this.logger.log(
      `🔍 Verifying Rider OTP for ${cleanPhone}: submitted="${code}" stored="${storedCode}"`,
    );

    if (!storedCode || storedCode !== code) {
      throw new UnauthorizedException(
        !storedCode
          ? 'Rider OTP has expired — please request a new one'
          : 'Incorrect OTP code — please try again',
      );
    }

    await this.redis.del(this.otpKey(cleanPhone));
    this.logger.log(`✅ Rider OTP verified for ${cleanPhone}`);

    return this.upsertRiderAndSign(cleanPhone, name, vehicleType);
  }

  private async upsertRiderAndSign(phone: string, name?: string, vehicleType?: string) {
    let rider = await this.prisma.rider.findUnique({
      where: { phone },
      include: { currentHub: true },
    });

    if (!rider) {
      rider = await this.prisma.rider.create({
        data: {
          phone,
          name: name || `Rider ${phone.slice(-4)}`,
          status: 'PENDING_APPROVAL',
          vehicleType: vehicleType || 'BIKE',
          capacityMax: 1,
        },
        include: { currentHub: true },
      });

      this.logger.log(
        `🛵 New Rider profile registered: ${phone} (ID: ${rider.id}) — Status: PENDING_APPROVAL`,
      );
    }

    const payload = {
      sub: rider.id,
      phone: rider.phone,
      role: 'RIDER',
      status: rider.status,
      currentHubId: rider.currentHubId,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      accessToken,
      rider,
    };
  }

  /**
   * List all riders with status, hub, and online filters (Admin only)
   */
  async getAllRiders(filters?: { status?: RiderStatus; hubId?: string; isOnline?: boolean }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.hubId) where.currentHubId = filters.hubId;
    if (filters?.isOnline !== undefined) where.isOnline = filters.isOnline;

    return this.prisma.rider.findMany({
      where,
      include: {
        currentHub: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Fetch riders awaiting KYC approval (Admin only)
   */
  async getApprovalQueue() {
    return this.prisma.rider.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: { currentHub: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get rider detail including recent trips and earnings ledger
   */
  /**
   * Hubs a rider may stage from (self-service).
   */
  async listHubs() {
    return this.prisma.hub.findMany({
      select: { id: true, name: true, city: true },
      orderBy: { name: 'asc' },
    });
  }

  async getRiderById(id: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { id },
      include: {
        currentHub: true,
        trips: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            order: {
              select: {
                id: true,
                status: true,
                finalPaidPaise: true,
                address: true,
              },
            },
          },
        },
        earnings: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!rider) {
      throw new NotFoundException(`Rider with ID '${id}' not found`);
    }

    return rider;
  }

  /**
   * Approve / Reject / Suspend rider KYC (Admin only)
   */
  async updateRiderStatus(
    id: string,
    status: RiderStatus,
    reason?: string,
    actorId?: string,
  ) {
    const validStatuses: RiderStatus[] = [
      'PENDING_APPROVAL',
      'APPROVED',
      'SUSPENDED',
      'REJECTED',
    ];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `status must be one of ${validStatuses.join(', ')}`,
      );
    }

    const existing = await this.prisma.rider.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Rider with ID '${id}' not found`);
    }

    const updated = await this.prisma.rider.update({
      where: { id },
      data: {
        status,
        approvedAt: status === 'APPROVED' ? new Date() : existing.approvedAt,
      },
      include: { currentHub: true },
    });

    // Write AuditLog for status transition
    await this.prisma.auditLog.create({
      data: {
        action: `RIDER_STATUS_${status}`,
        actorId: actorId || 'SYSTEM',
        recordId: id,
        diff: {
          previousStatus: existing.status,
          newStatus: status,
          reason: reason || null,
        },
      },
    }).catch(() => null);

    this.logger.log(`🛵 Rider ${id} status updated to '${status}'${reason ? ` (Reason: ${reason})` : ''}`);

    return updated;
  }

  /**
   * Update rider KYC documents and vehicle registration info
   */
  async updateRiderDocuments(
    id: string,
    docs: {
      vehicleType?: string;
      vehicleRegNo?: string;
      licenceDocUrl?: string;
      vehicleRcDocUrl?: string;
    },
  ) {
    const rider = await this.prisma.rider.findUnique({ where: { id } });
    if (!rider) {
      throw new NotFoundException(`Rider with ID '${id}' not found`);
    }

    return this.prisma.rider.update({
      where: { id },
      data: docs,
      include: { currentHub: true },
    });
  }

  /**
   * Update rider bank account token reference or UPI ID
   */
  async updateRiderBankDetails(
    id: string,
    bankDetails: { bankAccountRef?: string; upiId?: string },
  ) {
    const rider = await this.prisma.rider.findUnique({ where: { id } });
    if (!rider) {
      throw new NotFoundException(`Rider with ID '${id}' not found`);
    }

    return this.prisma.rider.update({
      where: { id },
      data: bankDetails,
      include: { currentHub: true },
    });
  }

  /**
   * Toggle online/offline status for rider
   */
  async toggleOnlineStatus(id: string, isOnline: boolean) {
    const rider = await this.prisma.rider.findUnique({ where: { id } });
    if (!rider) {
      throw new NotFoundException(`Rider with ID '${id}' not found`);
    }

    if (isOnline && rider.status !== 'APPROVED') {
      throw new BadRequestException(
        `Cannot go online: Rider KYC status is '${rider.status}'. Approval is required.`,
      );
    }

    const updated = await this.prisma.rider.update({
      where: { id },
      data: {
        isOnline,
        // Clear GPS coordinates when going offline
        liveLat: isOnline ? rider.liveLat : null,
        liveLng: isOnline ? rider.liveLng : null,
      },
      include: { currentHub: true },
    });

    this.logger.log(`🛵 Rider ${id} is now ${isOnline ? 'ONLINE 🟢' : 'OFFLINE ⚪'}`);
    return updated;
  }

  /**
   * Set rider current staged hub
   */
  async setCurrentHub(id: string, hubId: string) {
    const hub = await this.prisma.hub.findUnique({ where: { id: hubId } });
    if (!hub) {
      throw new NotFoundException(`Hub with ID '${hubId}' not found`);
    }

    return this.prisma.rider.update({
      where: { id },
      data: { currentHubId: hubId },
      include: { currentHub: true },
    });
  }

  /**
   * Aggregate RiderEarning records for a rider
   */
  async getRiderEarnings(id: string, startDate?: string, endDate?: string) {
    const rider = await this.prisma.rider.findUnique({ where: { id } });
    if (!rider) {
      throw new NotFoundException(`Rider with ID '${id}' not found`);
    }

    const createdAtFilter: any = {};
    if (startDate) createdAtFilter.gte = new Date(startDate);
    if (endDate) createdAtFilter.lte = new Date(endDate);

    const earnings = await this.prisma.riderEarning.findMany({
      where: {
        riderId: id,
        createdAt: Object.keys(createdAtFilter).length > 0 ? createdAtFilter : undefined,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPaise = earnings.reduce((sum, e) => sum + e.amountInPaise, 0);
    const breakdown = earnings.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + e.amountInPaise;
      return acc;
    }, {} as Record<string, number>);

    return {
      riderId: id,
      totalPaise,
      breakdown,
      earnings,
    };
  }
}
