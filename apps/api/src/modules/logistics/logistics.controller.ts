import {
  Controller,
  Post,
  Param,
  Get,
  Body,
  Request,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { Roles, AdminSubRoles } from '../../common/decorators/roles.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

/**
 * Dispatch / delivery state machine.
 *
 * Admin access is Operations + Super Admin only: finance, support, and
 * marketing admins have no business assigning riders or closing deliveries.
 * Rider and hub-manager principals are unaffected by the sub-role check.
 */
@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Post('auto-assign/:orderId')
  @Roles('ADMIN', 'HUB_MANAGER')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async autoAssignRider(@Request() req: any, @Param('orderId') orderId: string) {
    return this.logisticsService.autoAssignRider(
      orderId,
      req.user as AuthenticatedActor,
    );
  }

  @Post('rider/:id/location')
  @Roles('RIDER')
  async updateRiderLocation(
    @Request() req: any,
    @Param('id') riderId: string,
    @Body() body: { lat: number; lng: number },
  ) {
    this.assertSelf(req.user as AuthenticatedActor, riderId);
    return this.logisticsService.updateRiderLocation(riderId, body);
  }

  @Get('trips')
  @Roles('ADMIN', 'HUB_MANAGER')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getActiveTrips(@Request() req: any) {
    return this.logisticsService.getActiveTrips(req.user as AuthenticatedActor);
  }

  @Post('trips/:id/accept')
  @Roles('RIDER', 'ADMIN', 'HUB_MANAGER')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async acceptTrip(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body('riderId') riderId: string,
  ) {
    const actor = req.user as AuthenticatedActor;
    const actingRiderId = this.resolveRiderId(actor, riderId);
    return this.logisticsService.acceptTrip(tripId, actingRiderId, actor);
  }

  @Post('trips/:id/arrived-hub')
  @Roles('RIDER', 'ADMIN', 'HUB_MANAGER')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async arrivedAtHub(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body() body: { riderId: string; lat: number; lng: number },
  ) {
    const actor = req.user as AuthenticatedActor;
    const actingRiderId = this.resolveRiderId(actor, body.riderId);
    return this.logisticsService.arrivedAtHub(
      tripId,
      actingRiderId,
      body.lat,
      body.lng,
      actor,
    );
  }

  @Post('trips/:id/pickup')
  @Roles('RIDER', 'ADMIN', 'HUB_MANAGER')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async confirmPickup(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body('riderId') riderId: string,
  ) {
    const actor = req.user as AuthenticatedActor;
    const actingRiderId = this.resolveRiderId(actor, riderId);
    return this.logisticsService.confirmPickup(tripId, actingRiderId, actor);
  }

  @Post('trips/:id/arrived-customer')
  @Roles('RIDER', 'ADMIN', 'HUB_MANAGER')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async arrivedAtCustomer(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body('riderId') riderId: string,
  ) {
    const actor = req.user as AuthenticatedActor;
    const actingRiderId = this.resolveRiderId(actor, riderId);
    return this.logisticsService.arrivedAtCustomer(tripId, actingRiderId, actor);
  }

  @Post('trips/:id/deliver')
  @Roles('RIDER', 'ADMIN', 'HUB_MANAGER')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async verifyDeliveryOtp(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body() body: { riderId: string; otp: string; proofPhotoUrl?: string },
  ) {
    const actor = req.user as AuthenticatedActor;
    const actingRiderId = this.resolveRiderId(actor, body.riderId);
    return this.logisticsService.verifyDeliveryOtp(
      tripId,
      actingRiderId,
      body.otp,
      body.proofPhotoUrl,
      actor,
    );
  }

  @Post('trips/:id/reject')
  @Roles('RIDER', 'ADMIN', 'HUB_MANAGER')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async rejectTrip(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body() body: { riderId: string; reason: string },
  ) {
    const actor = req.user as AuthenticatedActor;
    const actingRiderId = this.resolveRiderId(actor, body.riderId);
    return this.logisticsService.rejectTrip(tripId, actingRiderId, body.reason, actor);
  }

  @Post('trips/:id/cancel')
  @Roles('ADMIN', 'HUB_MANAGER')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async cancelTrip(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body('reason') reason: string,
  ) {
    return this.logisticsService.cancelTrip(
      tripId,
      reason,
      req.user as AuthenticatedActor,
    );
  }

  @Get('trips/rider/:riderId/active')
  @Roles('RIDER', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getRiderActiveTrip(@Request() req: any, @Param('riderId') riderId: string) {
    this.assertSelf(req.user as AuthenticatedActor, riderId);
    return this.logisticsService.getRiderActiveTrip(riderId);
  }

  @Get('trips/rider/:riderId/history')
  @Roles('RIDER', 'ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getRiderTripHistory(@Request() req: any, @Param('riderId') riderId: string) {
    this.assertSelf(req.user as AuthenticatedActor, riderId);
    return this.logisticsService.getRiderTripHistory(riderId);
  }

  /** A rider may only ever act on their own record. */
  private assertSelf(actor: AuthenticatedActor, riderId: string) {
    if (actor?.role === 'RIDER' && actor.sub !== riderId) {
      throw new ForbiddenException('Riders can only act on their own trips');
    }
  }

  /**
   * Riders act as themselves. Ops staff must name the rider they are acting for,
   * because their JWT subject is a User id, not a Rider id.
   */
  private resolveRiderId(actor: AuthenticatedActor, riderId?: string): string {
    if (actor?.role === 'RIDER') {
      if (!riderId || actor.sub !== riderId) {
        throw new ForbiddenException('Riders can only act on their own trips');
      }
      return riderId;
    }

    if (!riderId) {
      throw new BadRequestException('riderId is required when acting on behalf of a rider');
    }

    return riderId;
  }
}
