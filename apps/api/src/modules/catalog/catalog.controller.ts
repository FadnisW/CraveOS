import { Controller, Get, Param, Query, Patch, Body, Post } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('brands')
  async getAllBrands() {
    return this.catalogService.getAllBrands();
  }

  @Get('brands/:slug')
  async getBrandBySlug(@Param('slug') slug: string) {
    return this.catalogService.getBrandBySlug(slug);
  }

  @Get('items')
  async getMenuItems(
    @Query('brand') brandSlug?: string,
    @Query('category') category?: string,
  ) {
    return this.catalogService.getMenuItems(brandSlug, category);
  }

  @Get('search')
  async searchItems(@Query('q') query: string) {
    return this.catalogService.searchItems(query);
  }

  @Patch('items/:id/86')
  async toggle86Item(
    @Param('id') itemId: string,
    @Body('isAvailable') isAvailable: boolean,
  ) {
    return this.catalogService.toggle86Item(itemId, isAvailable);
  }

  @Post('serviceability/resolve')
  async resolveServiceability(@Body('lat') lat: number, @Body('lng') lng: number) {
    return this.catalogService.resolveHubByCoords(lat || 12.9121, lng || 77.6445);
  }
}
