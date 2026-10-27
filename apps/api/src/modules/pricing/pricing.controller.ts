import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Request,
} from '@nestjs/common';
import { PricingService } from './pricing.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

interface QuoteDto {
  addressId?: string;
  hubId?: string;
  items?: { menuItemId?: string; quantity?: number }[];
  couponCode?: string;
  useWalletBalancePaise?: number;
}

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  /**
   * Server-authoritative cart quote.
   *
   * The client sends menu item ids and quantities. Prices, membership,
   * promotions, fees, GST and the wallet cap all come from the database.
   */
  @Post('quote')
  @Roles('CUSTOMER', 'ADMIN')
  async quote(@Request() req: any, @Body() body: QuoteDto) {
    const actor = req.user as AuthenticatedActor;

    if (!body || typeof body !== 'object') {
      throw new BadRequestException('A quote payload is required');
    }

    const forbiddenFields = [
      'price',
      'memberPrice',
      'mrp',
      'isMember',
      'userId',
      'useWalletBalance',
    ];
    for (const field of forbiddenFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        throw new BadRequestException(
          `'${field}' is not accepted. The server calculates every price.`,
        );
      }
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const items = body.items.map((item) => {
      const menuItemId = String(item?.menuItemId || '').trim();
      const quantity = Number(item?.quantity);

      if (!menuItemId) {
        throw new BadRequestException('Every cart line needs a menuItemId');
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException(
          'Quantity must be a positive whole number',
        );
      }

      return { menuItemId, quantity };
    });

    const useWalletBalancePaise = Number(body.useWalletBalancePaise ?? 0);
    if (
      !Number.isInteger(useWalletBalancePaise) ||
      useWalletBalancePaise < 0
    ) {
      throw new BadRequestException(
        'useWalletBalancePaise must be a non-negative whole number of paise',
      );
    }

    return this.pricingService.quote({
      userId: actor.sub,
      addressId: body.addressId,
      hubId: body.hubId,
      items,
      couponCode: body.couponCode,
      useWalletBalancePaise,
    });
  }

  @Get('offers/active')
  @Public()
  async getActiveOffers() {
    return this.pricingService.getActiveOffers();
  }
}
