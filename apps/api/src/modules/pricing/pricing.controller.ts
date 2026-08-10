import { Controller, Post, Body, Get } from '@nestjs/common';
import { PricingService, CalculatePriceInput } from './pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('calculate')
  async calculatePrice(@Body() input: CalculatePriceInput) {
    return this.pricingService.calculateCartPrice(input);
  }

  @Get('offers/active')
  async getActiveOffers() {
    return {
      happyHour: {
        title: 'Happy Hours Live • Daily 4 PM - 6 PM',
        discount: 'Flat 30% OFF + Extra 15% Cashback',
        endsAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      },
      mealOfDay: {
        title: 'MOJO 2X Loaded 10" Pizza @ ₹249',
        mrp: 499,
        memberPrice: 249,
      },
    };
  }
}
