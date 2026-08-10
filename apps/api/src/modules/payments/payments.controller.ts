import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-razorpay-order')
  async createRazorpayOrder(@Body('amount') amount: number, @Body('orderId') orderId: string) {
    return this.paymentsService.createRazorpayOrder(amount, orderId);
  }

  @Get('wallet/:userId')
  async getWalletBalance(@Param('userId') userId: string) {
    return this.paymentsService.getWalletBalance(userId);
  }
}
