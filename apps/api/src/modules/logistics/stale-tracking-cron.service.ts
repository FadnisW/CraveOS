import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class StaleTrackingCronService {
  private readonly logger = new Logger(StaleTrackingCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cron Job (SDD §7.5 & Task 11): Runs every 5 minutes to detect stale rider GPS pings.
   * If an active DeliveryTrip (ASSIGNED or PICKED_UP) has not updated its location/status for over 15 minutes,
   * it logs a severe alert for customer support & ops dashboard intervention.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleStaleTrackingCheck() {
    try {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

      const staleTrips = await this.prisma.deliveryTrip.findMany({
        where: {
          status: { in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_HUB', 'PICKED_UP', 'ARRIVING'] },
          lastPingAt: { lte: fifteenMinsAgo },
        },
        include: {
          order: true,
        },
      });

      if (staleTrips.length === 0) {
        return;
      }

      this.logger.error(
        `🚨 STALE RIDER ALERT: Found ${staleTrips.length} active delivery trip(s) with no GPS update for >15 minutes!`,
      );

      for (const trip of staleTrips) {
        this.logger.error(
          `⚠️ [RIDER_STUCK] Trip ID: ${trip.id} | Order ID: ${trip.orderId} | Rider ID: ${trip.riderId} | Status: ${trip.status} | Last Ping: ${trip.lastPingAt?.toISOString() || 'Never'}`,
        );

        // Update delivery trip status to STALE per AddendumPlan Chunk 8
        await this.prisma.deliveryTrip.update({
          where: { id: trip.id },
          data: { status: 'STALE' },
        }).catch(() => null);

        // Record AuditLog alert for operations team monitoring
        await this.prisma.auditLog.create({
          data: {
            action: 'RIDER_STUCK_ALERT',
            actorId: trip.riderId || 'SYSTEM_CRON',
            recordId: trip.id,
            diff: {
              orderId: trip.orderId,
              status: 'STALE',
              previousStatus: trip.status,
              lastPing: trip.lastPingAt?.toISOString() || 'Never',
              alertMessage: 'GPS location stale for >15 minutes',
            },
          },
        }).catch(() => null);
      }
    } catch (err: any) {
      this.logger.error(`Error executing StaleTrackingCronService: ${err.message}`);
    }
  }
}
