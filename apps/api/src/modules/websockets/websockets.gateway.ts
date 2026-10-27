import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { corsOrigins } from '../../common/config/env.validation';

interface SocketUser {
  sub: string;
  role: string;
  adminSubRole?: string | null;
  scopedHubId?: string | null;
  scopedBrandId?: string | null;
}

@WebSocketGateway({
  cors: {
    // Evaluated per handshake, after ConfigModule has loaded .env. A static
    // array at import time silently locked production sockets to localhost.
    origin: (
      origin: string,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || corsOrigins().includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin '${origin}' is not allowed`), false);
    },
    credentials: true,
  },
})
export class OrderTrackingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrderTrackingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Authenticate the socket handshake.
   *
   * Every room in this gateway carries order, customer, or staff data. The
   * previous implementation accepted anonymous sockets, so anyone who could
   * reach the port could subscribe to any order or hub's live updates.
   */
  async handleConnection(client: Socket) {
    try {
      const rawToken =
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '').trim();

      if (!rawToken) {
        throw new Error('Missing authentication token');
      }

      const claims = this.jwtService.verify(rawToken);
      if (!claims?.sub) {
        throw new Error('Malformed authentication token');
      }

      // Resolve the live identity from the database instead of trusting the
      // snapshot in the JWT (roles/scopes may have changed since sign-in).
      const dbUser = await this.prisma.user.findUnique({
        where: { id: claims.sub },
        select: {
          id: true,
          role: true,
          adminSubRole: true,
          scopedHubId: true,
          scopedBrandId: true,
          isBlocked: true,
        },
      });

      let user: SocketUser | null = dbUser
        ? {
            sub: dbUser.id,
            role: dbUser.role,
            adminSubRole: dbUser.adminSubRole,
            scopedHubId: dbUser.scopedHubId,
            scopedBrandId: dbUser.scopedBrandId,
          }
        : null;

      if (dbUser?.isBlocked) {
        user = null;
      }

      if (!user && claims.role === 'RIDER') {
        const rider = await this.prisma.rider.findUnique({
          where: { id: claims.sub },
          select: { id: true, status: true, currentHubId: true },
        });
        if (rider && rider.status !== 'SUSPENDED' && rider.status !== 'REJECTED') {
          user = {
            sub: rider.id,
            role: 'RIDER',
            scopedHubId: rider.currentHubId,
          };
        }
      }

      if (!user) {
        throw new Error('Account no longer exists or is blocked');
      }

      client.data.user = user;
      this.logger.log(`Socket ${client.id} authenticated as ${user.role} ${user.sub}`);
    } catch (error: any) {
      this.logger.warn(`Rejected socket ${client.id}: ${error?.message || 'unauthorized'}`);
      client.emit('unauthorized', { message: 'Authentication required' });
      client.disconnect(true);
    }
  }

  private async joinIfAllowed(
    client: Socket,
    room: string,
    allowed: boolean,
  ): Promise<{ status: string; room?: string }> {
    if (!allowed) {
      this.logger.warn(`Socket ${client.id} denied access to ${room}`);
      return { status: 'forbidden' };
    }

    await client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { status: 'joined', room };
  }

  @SubscribeMessage('joinOrderRoom')
  async handleJoinOrderRoom(
    @MessageBody() orderId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user || !orderId) return { status: 'forbidden' };

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        hubId: true,
        deliveryTrip: { select: { riderId: true } },
        brandOrders: { select: { brandId: true } },
      },
    });

    if (!order) return { status: 'not_found' };

    const allowed =
      user.role === 'ADMIN' ||
      (user.role === 'CUSTOMER' && order.userId === user.sub) ||
      (user.role === 'RIDER' && order.deliveryTrip?.riderId === user.sub) ||
      ((user.role === 'HUB_STAFF' || user.role === 'HUB_MANAGER') &&
        !!user.scopedHubId &&
        order.hubId === user.scopedHubId) ||
      (user.role === 'BRAND_OPS' &&
        !!user.scopedBrandId &&
        order.brandOrders.some((bo) => bo.brandId === user.scopedBrandId));

    return this.joinIfAllowed(client, `order:${orderId}`, allowed);
  }

  @SubscribeMessage('joinHubKdsRoom')
  async handleJoinHubKdsRoom(
    @MessageBody() hubId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user || !hubId) return { status: 'forbidden' };

    const allowed =
      user.role === 'ADMIN' ||
      ((user.role === 'HUB_STAFF' || user.role === 'HUB_MANAGER') &&
        user.scopedHubId === hubId);

    return this.joinIfAllowed(client, `hub:${hubId}:kds`, allowed);
  }

  @SubscribeMessage('joinAdminTicketsRoom')
  handleJoinAdminTicketsRoom(@ConnectedSocket() client: Socket) {
    const user = client.data.user as SocketUser | undefined;
    return this.joinIfAllowed(client, 'admin:tickets', user?.role === 'ADMIN');
  }

  @SubscribeMessage('joinAdminDashboardRoom')
  handleJoinAdminDashboardRoom(@ConnectedSocket() client: Socket) {
    const user = client.data.user as SocketUser | undefined;
    return this.joinIfAllowed(client, 'admin:dashboard', user?.role === 'ADMIN');
  }

  @SubscribeMessage('joinRiderRoom')
  handleJoinRiderRoom(
    @MessageBody() riderId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user || !riderId) return { status: 'forbidden' };

    const allowed =
      user.role === 'ADMIN' || (user.role === 'RIDER' && user.sub === riderId);

    return this.joinIfAllowed(client, `rider:${riderId}`, allowed);
  }

  @SubscribeMessage('joinBrandRoom')
  handleJoinBrandRoom(
    @MessageBody() brandId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user || !brandId) return { status: 'forbidden' };

    const allowed =
      user.role === 'ADMIN' ||
      (user.role === 'BRAND_OPS' && user.scopedBrandId === brandId);

    return this.joinIfAllowed(client, `brand:${brandId}`, allowed);
  }

  @SubscribeMessage('joinUserRoom')
  handleJoinUserRoom(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user || !userId) return { status: 'forbidden' };

    const allowed = user.role === 'ADMIN' || user.sub === userId;
    return this.joinIfAllowed(client, `user:${userId}`, allowed);
  }

  // --- Real-Time Event Matrix Emitters (A§7) ---

  emitOrderStatusUpdate(orderId: string, status: string, payload: any) {
    this.server.to(`order:${orderId}`).emit('orderStatusChanged', { status, payload });
  }

  emitRiderLocationUpdate(orderId: string, location: { lat: number; lng: number; riderId: string }) {
    this.server.to(`order:${orderId}`).emit('riderLocationUpdate', location);
  }

  emitKdsTicketUpdate(hubId: string, ticket: any) {
    this.server.to(`hub:${hubId}:kds`).emit('kdsTicketUpdated', ticket);
  }

  emitTripOffered(riderId: string, trip: any) {
    this.server.to(`rider:${riderId}`).emit('tripOffered', trip);
  }

  emitTripAccepted(orderId: string, payload: any) {
    this.server.to(`order:${orderId}`).emit('tripAccepted', payload);
    this.server.to('admin:dashboard').emit('tripAccepted', payload);
  }

  emitRiderArrivedAtHub(hubId: string, payload: any) {
    this.server.to(`hub:${hubId}:kds`).emit('riderArrivedAtHub', payload);
  }

  emitRiderPickedUp(orderId: string, hubId: string, payload: any) {
    this.server.to(`order:${orderId}`).emit('riderPickedUp', payload);
    this.server.to(`hub:${hubId}:kds`).emit('riderPickedUp', payload);
  }

  emitDeliveryVerified(orderId: string, payload: any) {
    this.server.to(`order:${orderId}`).emit('deliveryVerified', payload);
    this.server.to('admin:dashboard').emit('deliveryVerified', payload);
  }

  emitTicketCreated(ticket: any) {
    this.server.to('admin:tickets').emit('ticketCreated', ticket);
  }

  emitBrandOrderRejected(orderId: string, brandId: string, payload: any) {
    this.server.to(`order:${orderId}`).emit('brandOrderRejected', payload);
    this.server.to(`brand:${brandId}`).emit('brandOrderRejected', payload);
  }
}
