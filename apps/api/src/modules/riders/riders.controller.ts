import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RidersService } from './riders.service';
import { Roles, AdminSubRoles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RiderStatus } from '@prisma/client';

@Controller('riders')
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  /**
   * Public: Rider phone OTP registration
   */
  @Post('register')
  @Public()
  async registerRider(@Body('phone') phone: string) {
    return this.ridersService.registerRider(phone);
  }

  /**
   * Public: Verify rider phone OTP
   */
  @Post('verify-otp')
  @Public()
  async verifyRiderOtp(
    @Body('phone') phone: string,
    @Body('code') code: string,
    @Body('name') name?: string,
    @Body('vehicleType') vehicleType?: string,
  ) {
    return this.ridersService.verifyRiderOtp(phone, code, name, vehicleType);
  }

  /**
   * Admin (Ops/Super): Get riders in pending KYC approval queue
   */
  @Get('approval-queue')
  @Roles('ADMIN')
  @AdminSubRoles('SUPER_ADMIN', 'OPERATIONS_ADMIN')
  async getApprovalQueue() {
    return this.ridersService.getApprovalQueue();
  }

  /**
   * Admin (Ops/Super): List all riders with filters
   */
  @Get()
  @Roles('ADMIN')
  @AdminSubRoles('SUPER_ADMIN', 'OPERATIONS_ADMIN')
  async getAllRiders(
    @Query('status') status?: RiderStatus,
    @Query('hubId') hubId?: string,
    @Query('isOnline') isOnline?: string,
  ) {
    const isOnlineBool = isOnline !== undefined ? isOnline === 'true' : undefined;
    return this.ridersService.getAllRiders({ status, hubId, isOnline: isOnlineBool });
  }

  /**
   * Admin / Self (Rider): Get rider details
   */
  @Get(':id')
  @Roles('ADMIN', 'RIDER')
  async getRiderById(@Param('id') id: string) {
    return this.ridersService.getRiderById(id);
  }

  /**
   * Admin (Ops/Super): Approve / Reject / Suspend rider KYC
   */
  @Patch(':id/status')
  @Roles('ADMIN')
  @AdminSubRoles('SUPER_ADMIN', 'OPERATIONS_ADMIN')
  async updateRiderStatus(
    @Param('id') id: string,
    @Body('status') status: RiderStatus,
    @Body('reason') reason?: string,
  ) {
    return this.ridersService.updateRiderStatus(id, status, reason);
  }

  /**
   * Self (Rider): Upload / update KYC documents and vehicle registration
   */
  @Patch(':id/documents')
  @Roles('RIDER')
  async updateRiderDocuments(
    @Param('id') id: string,
    @Body()
    docs: {
      vehicleType?: string;
      vehicleRegNo?: string;
      licenceDocUrl?: string;
      vehicleRcDocUrl?: string;
    },
  ) {
    return this.ridersService.updateRiderDocuments(id, docs);
  }

  /**
   * Self (Rider): Update bank / UPI details
   */
  @Patch(':id/bank')
  @Roles('RIDER')
  async updateRiderBankDetails(
    @Param('id') id: string,
    @Body() bankDetails: { bankAccountRef?: string; upiId?: string },
  ) {
    return this.ridersService.updateRiderBankDetails(id, bankDetails);
  }

  /**
   * Self (Rider): Toggle online/offline status
   */
  @Patch(':id/online')
  @Roles('RIDER')
  async toggleOnlineStatus(
    @Param('id') id: string,
    @Body('isOnline') isOnline: boolean,
  ) {
    return this.ridersService.toggleOnlineStatus(id, isOnline);
  }

  /**
   * Self (Rider): Set current staged hub
   */
  @Patch(':id/hub')
  @Roles('RIDER')
  async setCurrentHub(
    @Param('id') id: string,
    @Body('hubId') hubId: string,
  ) {
    return this.ridersService.setCurrentHub(id, hubId);
  }

  /**
   * Self / Admin (Finance/Super): Get rider earnings ledger
   */
  @Get(':id/earnings')
  @Roles('RIDER', 'ADMIN')
  async getRiderEarnings(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ridersService.getRiderEarnings(id, startDate, endDate);
  }
}
