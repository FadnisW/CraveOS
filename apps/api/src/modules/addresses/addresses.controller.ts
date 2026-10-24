import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { AddressesService, UpsertAddressDto } from './addresses.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @Roles('CUSTOMER', 'ADMIN')
  async listAddresses(@Request() req: any) {
    return this.addressesService.listAddresses(req.user as AuthenticatedActor);
  }

  @Post()
  @Roles('CUSTOMER', 'ADMIN')
  async createAddress(@Request() req: any, @Body() dto: UpsertAddressDto) {
    return this.addressesService.createAddress(dto, req.user as AuthenticatedActor);
  }

  /**
   * Idempotent provisioning used by checkout: creates the address once and
   * returns the canonical row afterwards.
   */
  @Post('ensure')
  @Roles('CUSTOMER', 'ADMIN')
  async ensureAddress(@Request() req: any, @Body() dto: UpsertAddressDto) {
    return this.addressesService.ensureAddress(dto, req.user as AuthenticatedActor);
  }

  @Patch(':id')
  @Roles('CUSTOMER', 'ADMIN')
  async updateAddress(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<UpsertAddressDto>,
  ) {
    return this.addressesService.updateAddress(id, dto, req.user as AuthenticatedActor);
  }

  @Delete(':id')
  @Roles('CUSTOMER', 'ADMIN')
  async deleteAddress(@Request() req: any, @Param('id') id: string) {
    return this.addressesService.deleteAddress(id, req.user as AuthenticatedActor);
  }
}
