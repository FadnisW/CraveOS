import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class OrderTrackingGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrderTrackingGateway.name);

  @SubscribeMessage('joinOrderRoom')
  handleJoinOrderRoom(
    @MessageBody() orderId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `order:${orderId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { status: 'joined', room };
  }

  @SubscribeMessage('joinHubKdsRoom')
  handleJoinHubKdsRoom(
    @MessageBody() hubId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `hub:${hubId}:kds`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined KDS ${room}`);
    return { status: 'joined', room };
  }

  @SubscribeMessage('joinAdminTicketsRoom')
  handleJoinAdminTicketsRoom(@ConnectedSocket() client: Socket) {
    const room = 'admin:tickets';
    client.join(room);
    this.logger.log(`Client ${client.id} joined admin tickets room`);
    return { status: 'joined', room };
  }

  @SubscribeMessage('joinAdminDashboardRoom')
  handleJoinAdminDashboardRoom(@ConnectedSocket() client: Socket) {
    const room = 'admin:dashboard';
    client.join(room);
    this.logger.log(`Client ${client.id} joined admin dashboard room`);
    return { status: 'joined', room };
  }

  @SubscribeMessage('joinRiderRoom')
  handleJoinRiderRoom(
    @MessageBody() riderId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `rider:${riderId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined rider room ${room}`);
    return { status: 'joined', room };
  }

  @SubscribeMessage('joinBrandRoom')
  handleJoinBrandRoom(
    @MessageBody() brandId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `brand:${brandId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined brand room ${room}`);
    return { status: 'joined', room };
  }

  @SubscribeMessage('joinUserRoom')
  handleJoinUserRoom(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `user:${userId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined user room ${room}`);
    return { status: 'joined', room };
  }

  // --- Real-Time Event Matrix Emitters (§7) ---

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
