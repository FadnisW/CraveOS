import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Patch,
  Request,
  Headers,
} from '@nestjs/common';
import { OrdersService, CreateOrderDto, AuthenticatedActor } from './orders.service';
import { Roles, AdminSubRoles } from '../../common/decorators/roles.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles('CUSTOMER', 'ADMIN')
  async createOrder(
    @Request() req: any,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.createOrder(
      dto,
      req.user as AuthenticatedActor,
      idempotencyKey,
    );
  }

  @Get(':id')
  @Roles('CUSTOMER', 'RIDER', 'HUB_STAFF', 'HUB_MANAGER', 'BRAND_OPS', 'ADMIN')
  async getOrderById(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.getOrderById(id, req.user as AuthenticatedActor);
  }

  @Get('user/:userId')
  @Roles('CUSTOMER', 'ADMIN')
  async getUserOrders(@Request() req: any, @Param('userId') userId: string) {
    return this.ordersService.getUserOrders(userId, req.user as AuthenticatedActor);
  }

  /**
   * Cancels an order before the kitchen accepts it. Paid orders are refunded
   * in full; unpaid attempts are simply closed.
   */
  @Post(':id/cancel')
  @Roles('CUSTOMER', 'ADMIN')
  async cancelOrder(
    @Request() req: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.ordersService.cancelOrder(id, req.user as AuthenticatedActor, reason);
  }

  @Patch('brand-tickets/:ticketId/status')
  @Roles('BRAND_OPS', 'HUB_STAFF', 'HUB_MANAGER', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async updateBrandOrderStatus(
    @Request() req: any,
    @Param('ticketId') ticketId: string,
    @Body('status') status: 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED',
    @Body('rejectReason') rejectReason?: string,
  ) {
    return this.ordersService.updateBrandOrderStatus(
      ticketId,
      status,
      req.user as AuthenticatedActor,
      rejectReason,
    );
  }
}
