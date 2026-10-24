import { Controller, Post, Body, Get } from '@nestjs/common';
import { PricingService, CalculatePriceInput } from './pricing.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('calculate')
  @Public()
  async calculatePrice(@Body() input: CalculatePriceInput) {
    return this.pricingService.calculateCartPrice(input);
  }

  @Get('offers/active')
  @Public()
  async getActiveOffers() {
    return this.pricingService.getActiveOffers();
  }
}
