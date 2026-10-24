import { Controller, Post, Get, Body, Param, Patch, Request } from '@nestjs/common';
import { OrdersService, CreateOrderDto, AuthenticatedActor } from './orders.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles('CUSTOMER', 'ADMIN')
  async createOrder(@Request() req: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto, req.user as AuthenticatedActor);
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
   * Cancels an unpaid order (e.g. the customer dismissed the Razorpay modal).
   */
  @Post(':id/cancel')
  @Roles('CUSTOMER', 'ADMIN')
  async cancelOrder(
    @Request() req: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.ordersService.cancelUnpaidOrder(id, req.user as AuthenticatedActor, reason);
  }

  @Patch('brand-tickets/:ticketId/status')
  @Roles('BRAND_OPS', 'HUB_STAFF', 'HUB_MANAGER', 'ADMIN')
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
