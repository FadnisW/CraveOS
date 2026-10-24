import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { BrandOpsService } from './brand-ops.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('brand-ops')
export class BrandOpsController {
  constructor(private readonly brandOpsService: BrandOpsService) {}

  /**
   * Brand Dashboard (§5.2)
   */
  @Get(':brandId/dashboard')
  @Roles('BRAND_OPS', 'ADMIN')
  async getBrandDashboard(@Param('brandId') brandId: string) {
    return this.brandOpsService.getBrandDashboard(brandId);
  }

  /**
   * Get Brand Menu Catalog (§5.2)
   */
  @Get(':brandId/menu')
  @Roles('BRAND_OPS', 'ADMIN')
  async getBrandMenu(@Param('brandId') brandId: string) {
    return this.brandOpsService.getBrandMenu(brandId);
  }

  /**
   * Create Menu Item (§5.2)
   */
  @Post(':brandId/menu/items')
  @Roles('BRAND_OPS', 'ADMIN')
  async createMenuItem(
    @Param('brandId') brandId: string,
    @Body() body: any,
  ) {
    return this.brandOpsService.createMenuItem(brandId, body);
  }

  /**
   * Update Menu Item (§5.2)
   */
  @Patch(':brandId/menu/items/:id')
  @Roles('BRAND_OPS', 'ADMIN')
  async updateMenuItem(
    @Param('brandId') brandId: string,
    @Param('id') itemId: string,
    @Body() body: any,
  ) {
    return this.brandOpsService.updateMenuItem(brandId, itemId, body);
  }

  /**
   * Delete Menu Item (§5.2)
   */
  @Delete(':brandId/menu/items/:id')
  @Roles('BRAND_OPS', 'ADMIN')
  async deleteMenuItem(
    @Param('brandId') brandId: string,
    @Param('id') itemId: string,
  ) {
    return this.brandOpsService.deleteMenuItem(brandId, itemId);
  }

  /**
   * Bulk Price Update (§5.2)
   */
  @Patch(':brandId/menu/items/bulk-price')
  @Roles('BRAND_OPS', 'ADMIN')
  async bulkUpdatePrice(
    @Param('brandId') brandId: string,
    @Body('updates') updates: { itemId: string; mrpInPaise: number; memberPriceInPaise?: number }[],
  ) {
    return this.brandOpsService.bulkUpdatePrice(brandId, updates);
  }

  /**
   * Propose Promotion Deal (§5.2)
   */
  @Post(':brandId/promotions/propose')
  @Roles('BRAND_OPS', 'ADMIN')
  async proposePromotion(
    @Param('brandId') brandId: string,
    @Body()
    body: {
      type: 'HAPPY_HOUR' | 'MEAL_OF_DAY' | 'BOGO' | 'COUPON';
      startsAt: string;
      endsAt: string;
      config: any;
    },
  ) {
    return this.brandOpsService.proposePromotion(brandId, body);
  }

  /**
   * Brand Analytics (§5.2)
   */
  @Get(':brandId/analytics')
  @Roles('BRAND_OPS', 'ADMIN')
  async getBrandAnalytics(@Param('brandId') brandId: string) {
    return this.brandOpsService.getBrandAnalytics(brandId);
  }

  /**
   * Brand Finance Overview (§5.2)
   */
  @Get(':brandId/finance')
  @Roles('BRAND_OPS', 'ADMIN')
  async getBrandFinance(@Param('brandId') brandId: string) {
    return this.brandOpsService.getBrandFinance(brandId);
  }
}
