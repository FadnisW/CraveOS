import { Controller, Get, Param, Query, Patch, Body, Post, Request } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles, AdminSubRoles } from '../../common/decorators/roles.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('brands')
  @Public()
  async getAllBrands() {
    return this.catalogService.getAllBrands();
  }

  @Get('brands/:slug')
  @Public()
  async getBrandBySlug(@Param('slug') slug: string) {
    return this.catalogService.getBrandBySlug(slug);
  }

  @Get('items')
  @Public()
  async getMenuItems(
    @Query('brand') brandSlug?: string,
    @Query('category') category?: string,
  ) {
    return this.catalogService.getMenuItems(brandSlug, category);
  }

  @Get('search')
  @Public()
  async searchItems(@Query('q') query: string) {
    return this.catalogService.searchItems(query);
  }

  @Patch('items/:id/86')
  @Roles('BRAND_OPS', 'HUB_STAFF', 'HUB_MANAGER', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async toggle86Item(
    @Request() req: any,
    @Param('id') itemId: string,
    @Body('isAvailable') isAvailable: boolean,
  ) {
    return this.catalogService.toggle86Item(
      itemId,
      isAvailable,
      req.user as AuthenticatedActor,
    );
  }

  @Post('serviceability/resolve')
  @Public()
  async resolveServiceability(@Body('lat') lat: number, @Body('lng') lng: number) {
    return this.catalogService.resolveHubByCoords(lat || 12.9121, lng || 77.6445);
  }
}
