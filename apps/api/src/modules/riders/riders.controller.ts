import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { RidersService } from './riders.service';
import { Roles, AdminSubRoles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RiderStatus } from '@prisma/client';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

@Controller('riders')
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  /**
   * A rider may only act on their own rider record. Rider tokens use the
   * Rider table id as `sub`, which is why the check compares against that id
   * rather than the User table.
   */
  private assertSelf(actor: AuthenticatedActor, riderId: string) {
    if (actor?.role === 'ADMIN') return;
    if (actor?.role !== 'RIDER' || actor.sub !== riderId) {
      throw new ForbiddenException('You can only access your own rider account');
    }
  }

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
   * Self (Rider): Hubs a rider may stage from.
   *
   * Riders cannot read the hub-ops module, so this is the narrow read they
   * need to pick a staging hub. Only identity fields are exposed.
   */
  @Get('hubs')
  @Roles('RIDER')
  async listRiderHubs() {
    return this.ridersService.listHubs();
  }

  /**
   * Admin / Self (Rider): Get rider details
   */
  @Get(':id')
  @Roles('ADMIN', 'RIDER')
  @AdminSubRoles('SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN')
  async getRiderById(@Request() req: any, @Param('id') id: string) {
    this.assertSelf(req.user as AuthenticatedActor, id);
    return this.ridersService.getRiderById(id);
  }

  /**
   * Admin (Ops/Super): Approve / Reject / Suspend rider KYC
   */
  @Patch(':id/status')
  @Roles('ADMIN')
  @AdminSubRoles('SUPER_ADMIN', 'OPERATIONS_ADMIN')
  async updateRiderStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: RiderStatus,
    @Body('reason') reason?: string,
  ) {
    return this.ridersService.updateRiderStatus(
      id,
      status,
      reason,
      (req.user as AuthenticatedActor)?.sub,
    );
  }

  /**
   * Self (Rider): Upload / update KYC documents and vehicle registration
   */
  @Patch(':id/documents')
  @Roles('RIDER')
  async updateRiderDocuments(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    docs: {
      vehicleType?: string;
      vehicleRegNo?: string;
      licenceDocUrl?: string;
      vehicleRcDocUrl?: string;
    },
  ) {
    this.assertSelf(req.user as AuthenticatedActor, id);
    return this.ridersService.updateRiderDocuments(id, docs);
  }

  /**
   * Self (Rider): Update bank / UPI details
   */
  @Patch(':id/bank')
  @Roles('RIDER')
  async updateRiderBankDetails(
    @Request() req: any,
    @Param('id') id: string,
    @Body() bankDetails: { bankAccountRef?: string; upiId?: string },
  ) {
    this.assertSelf(req.user as AuthenticatedActor, id);
    return this.ridersService.updateRiderBankDetails(id, bankDetails);
  }

  /**
   * Self (Rider): Toggle online/offline status
   */
  @Patch(':id/online')
  @Roles('RIDER')
  async toggleOnlineStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('isOnline') isOnline: boolean,
  ) {
    this.assertSelf(req.user as AuthenticatedActor, id);
    return this.ridersService.toggleOnlineStatus(id, isOnline);
  }

  /**
   * Self (Rider): Set current staged hub
   */
  @Patch(':id/hub')
  @Roles('RIDER')
  async setCurrentHub(
    @Request() req: any,
    @Param('id') id: string,
    @Body('hubId') hubId: string,
  ) {
    this.assertSelf(req.user as AuthenticatedActor, id);
    return this.ridersService.setCurrentHub(id, hubId);
  }

  /**
   * Self / Admin (Finance, Ops, Super): Get rider earnings ledger
   */
  @Get(':id/earnings')
  @Roles('RIDER', 'ADMIN')
  @AdminSubRoles('FINANCE_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getRiderEarnings(
    @Request() req: any,
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.assertSelf(req.user as AuthenticatedActor, id);
    return this.ridersService.getRiderEarnings(id, startDate, endDate);
  }
}
