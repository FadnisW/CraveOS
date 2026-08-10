import { Controller, Post, Get, Body, Param, Patch } from '@nestjs/common';
import { OrdersService, CreateOrderDto } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Get(':id')
  async getOrderById(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Get('user/:userId')
  async getUserOrders(@Param('userId') userId: string) {
    return this.ordersService.getUserOrders(userId);
  }

  @Patch('brand-tickets/:ticketId/status')
  async updateBrandOrderStatus(
    @Param('ticketId') ticketId: string,
    @Body('status') status: 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED',
  ) {
    return this.ordersService.updateBrandOrderStatus(ticketId, status);
  }
}
