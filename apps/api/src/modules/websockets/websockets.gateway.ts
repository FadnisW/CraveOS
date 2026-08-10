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

  emitOrderStatusUpdate(orderId: string, status: string, payload: any) {
    this.server.to(`order:${orderId}`).emit('orderStatusChanged', { status, payload });
  }

  emitKdsTicketUpdate(hubId: string, ticket: any) {
    this.server.to(`hub:${hubId}:kds`).emit('kdsTicketUpdated', ticket);
  }
}
