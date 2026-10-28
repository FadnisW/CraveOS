import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { Public } from '../../common/decorators/public.decorator';
import { AdminSubRoles, Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * Public, approved review text for one brand. No stars, no averages: the
   * storefront renders exactly what a human approved.
   */
  @Get('brands/:slug')
  @Public()
  async getBrandReviews(@Param('slug') slug: string) {
    return this.reviewsService.getBrandReviews(slug);
  }

  /**
   * Write the single review for a delivered order.
   */
  @Post()
  @Roles('CUSTOMER')
  @HttpCode(201)
  async createReview(
    @Request() req: any,
    @Body() body: { orderId?: string; body?: string },
  ) {
    return this.reviewsService.createReview(
      req.user as AuthenticatedActor,
      body || {},
    );
  }

  /**
   * The caller's own review for an order, including its moderation status.
   */
  @Get('orders/:orderId')
  @Roles('CUSTOMER', 'ADMIN')
  async getOrderReview(@Request() req: any, @Param('orderId') orderId: string) {
    return this.reviewsService.getOrderReview(
      orderId,
      req.user as AuthenticatedActor,
    );
  }

  /**
   * Moderation queue. Support and operations staff review the text before it
   * becomes public.
   */
  @Get('moderation')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async listForModeration(@Query('status') status?: string) {
    return this.reviewsService.listForModeration(status);
  }

  @Patch(':id/moderate')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN')
  @HttpCode(200)
  async moderateReview(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { status?: string; note?: string },
  ) {
    return this.reviewsService.moderateReview(
      id,
      req.user as AuthenticatedActor,
      body || {},
    );
  }
}
