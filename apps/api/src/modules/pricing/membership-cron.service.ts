import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MembershipCronService {
  private readonly logger = new Logger(MembershipCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Cron job running every 10 minutes to auto-expire past-due trial & active memberships
   * and trigger automated renewal emails via Resend.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleMembershipExpiryCron() {
    const now = new Date();

    const expiredMemberships = await this.prisma.membership.findMany({
      where: {
        status: { in: ['TRIAL', 'ACTIVE'] },
        endsAt: { lt: now },
      },
      include: {
        user: true,
      },
    });

    if (expiredMemberships.length === 0) {
      return;
    }

    this.logger.log(`Cron: Found ${expiredMemberships.length} expired memberships. Processing auto-expiry...`);

    for (const membership of expiredMemberships) {
      await this.prisma.membership.update({
        where: {id: membership.id},
        data: { status: 'EXPIRED' },
      });

      this.logger.log(`Membership ${membership.id} (User: ${membership.user.email}) marked as EXPIRED.`);

      if (membership.user.email) {
        await this.notificationsService.sendMembershipExpiryEmail(
          membership.user.email,
          membership.user.name || undefined,
        );
      }
    }
  }
}
