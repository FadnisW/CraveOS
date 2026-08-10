import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async autoAssignRider(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { hub: true },
    });
    if (!order) return null;

    const rider = await this.prisma.user.findFirst();

    const trip = await this.prisma.deliveryTrip.create({
      data: {
        orderId,
        riderId: rider ? rider.id : null,
        status: 'ASSIGNED',
        pickupLat: order.hub.lat,
        pickupLng: order.hub.lng,
      },
    });

    this.logger.log(`🛵 Auto-assigned delivery trip ${trip.id} for Order ${order.id}`);

    return {
      trip,
    };
  }

  async getActiveTrips() {
    return this.prisma.deliveryTrip.findMany({
      include: {
        order: {
          include: {
            address: true,
            brandOrders: {
              include: { items: true },
            },
          },
        },
      },
    });
  }
}
