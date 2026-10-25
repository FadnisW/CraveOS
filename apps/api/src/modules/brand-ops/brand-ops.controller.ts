import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { BrandOpsService } from './brand-ops.service';
import { Roles, AdminSubRoles } from '../../common/decorators/roles.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

/**
 * Brand operations console.
 *
 * Admin access is limited to Operations + Super Admin. Brand operators are
 * unaffected (the sub-role check only applies to `role === 'ADMIN'`), but a
 * support/finance/marketing admin must not be able to rewrite menu prices.
 */
@Controller('brand-ops')
export class BrandOpsController {
  constructor(private readonly brandOpsService: BrandOpsService) {}

  /**
   * Defence in depth: the RolesGuard scopes `:brandId` routes, but a brand
   * operator must also never be able to pass a brand id that is not theirs.
   */
  private assertBrandScope(actor: AuthenticatedActor, brandId: string) {
    if (actor?.role === 'ADMIN') return;
    if (actor?.role !== 'BRAND_OPS' || actor.scopedBrandId !== brandId) {
      throw new ForbiddenException('You can only manage your own brand');
    }
  }

  /**
   * Brand Dashboard (AA5.2)
   */
  @Get(':brandId/dashboard')
  @Roles('BRAND_OPS', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getBrandDashboard(@Request() req: any, @Param('brandId') brandId: string) {
    this.assertBrandScope(req.user as AuthenticatedActor, brandId);
    return this.brandOpsService.getBrandDashboard(brandId);
  }

  /**
   * Get Brand Menu Catalog (AA5.2)
   */
  @Get(':brandId/menu')
  @Roles('BRAND_OPS', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getBrandMenu(@Request() req: any, @Param('brandId') brandId: string) {
    this.assertBrandScope(req.user as AuthenticatedActor, brandId);
    return this.brandOpsService.getBrandMenu(brandId);
  }

  /**
   * Create Menu Item (AA5.2)
   */
  @Post(':brandId/menu/items')
  @Roles('BRAND_OPS', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async createMenuItem(
    @Request() req: any,
    @Param('brandId') brandId: string,
    @Body() body: any,
  ) {
    this.assertBrandScope(req.user as AuthenticatedActor, brandId);
    return this.brandOpsService.createMenuItem(brandId, body);
  }

  /**
   * Bulk Price Update (AA5.2)
   *
   * Declared before `:id` on purpose: Express matches routes in declaration
   * order, so `PATCH /menu/items/bulk-price` used to be swallowed by the
   * `:id` update route and returned 404.
   */
  @Patch(':brandId/menu/items/bulk-price')
  @Roles('BRAND_OPS', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async bulkUpdatePrice(
    @Request() req: any,
    @Param('brandId') brandId: string,
    @Body('updates') updates: { itemId: string; mrpInPaise: number; memberPriceInPaise?: number }[],
  ) {
    this.assertBrandScope(req.user as AuthenticatedActor, brandId);
    return this.brandOpsService.bulkUpdatePrice(brandId, updates);
  }

  /**
   * Update Menu Item (AA5.2)
   */
  @Patch(':brandId/menu/items/:id')
  @Roles('BRAND_OPS', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async updateMenuItem(
    @Request() req: any,
    @Param('brandId') brandId: string,
    @Param('id') itemId: string,
    @Body() body: any,
  ) {
    this.assertBrandScope(req.user as AuthenticatedActor, brandId);
    return this.brandOpsService.updateMenuItem(brandId, itemId, body);
  }

  /**
   * Delete Menu Item (AA5.2)
   */
  @Delete(':brandId/menu/items/:id')
  @Roles('BRAND_OPS', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async deleteMenuItem(
    @Request() req: any,
    @Param('brandId') brandId: string,
    @Param('id') itemId: string,
  ) {
    this.assertBrandScope(req.user as AuthenticatedActor, brandId);
    return this.brandOpsService.deleteMenuItem(brandId, itemId);
  }

  /**
   * Propose Promotion Deal (AA5.2)
   */
  @Post(':brandId/promotions/propose')
  @Roles('BRAND_OPS', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async proposePromotion(
    @Request() req: any,
    @Param('brandId') brandId: string,
    @Body()
    body: {
      type: 'HAPPY_HOUR' | 'MEAL_OF_DAY' | 'BOGO' | 'COUPON';
      startsAt: string;
      endsAt: string;
      config: any;
    },
  ) {
    this.assertBrandScope(req.user as AuthenticatedActor, brandId);
    return this.brandOpsService.proposePromotion(brandId, body);
  }

  /**
   * Brand Analytics (AA5.2)
   */
  @Get(':brandId/analytics')
  @Roles('BRAND_OPS', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getBrandAnalytics(@Request() req: any, @Param('brandId') brandId: string) {
    this.assertBrandScope(req.user as AuthenticatedActor, brandId);
    return this.brandOpsService.getBrandAnalytics(brandId);
  }

  /**
   * Brand Finance Overview (AA5.2)
   */
  @Get(':brandId/finance')
  @Roles('BRAND_OPS', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getBrandFinance(@Request() req: any, @Param('brandId') brandId: string) {
    this.assertBrandScope(req.user as AuthenticatedActor, brandId);
    return this.brandOpsService.getBrandFinance(brandId);
  }
}
