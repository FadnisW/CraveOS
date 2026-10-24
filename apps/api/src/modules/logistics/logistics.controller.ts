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
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Post('auto-assign/:orderId')
  @Roles('ADMIN', 'HUB_MANAGER')
  async autoAssignRider(@Param('orderId') orderId: string) {
    return this.logisticsService.autoAssignRider(orderId);
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
  async getActiveTrips() {
    return this.logisticsService.getActiveTrips();
  }

  @Post('trips/:id/accept')
  @Roles('RIDER', 'ADMIN', 'HUB_MANAGER')
  async acceptTrip(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body('riderId') riderId: string,
  ) {
    const actingRiderId = this.resolveRiderId(req.user as AuthenticatedActor, riderId);
    return this.logisticsService.acceptTrip(tripId, actingRiderId);
  }

  @Post('trips/:id/arrived-hub')
  @Roles('RIDER', 'ADMIN', 'HUB_MANAGER')
  async arrivedAtHub(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body() body: { riderId: string; lat: number; lng: number },
  ) {
    const actingRiderId = this.resolveRiderId(req.user as AuthenticatedActor, body.riderId);
    return this.logisticsService.arrivedAtHub(tripId, actingRiderId, body.lat, body.lng);
  }

  @Post('trips/:id/pickup')
  @Roles('RIDER', 'ADMIN', 'HUB_MANAGER')
  async confirmPickup(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body('riderId') riderId: string,
  ) {
    const actingRiderId = this.resolveRiderId(req.user as AuthenticatedActor, riderId);
    return this.logisticsService.confirmPickup(tripId, actingRiderId);
  }

  @Post('trips/:id/arrived-customer')
  @Roles('RIDER', 'ADMIN', 'HUB_MANAGER')
  async arrivedAtCustomer(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body('riderId') riderId: string,
  ) {
    const actingRiderId = this.resolveRiderId(req.user as AuthenticatedActor, riderId);
    return this.logisticsService.arrivedAtCustomer(tripId, actingRiderId);
  }

  @Post('trips/:id/deliver')
  @Roles('RIDER', 'ADMIN', 'HUB_MANAGER')
  async verifyDeliveryOtp(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body() body: { riderId: string; otp: string; proofPhotoUrl?: string },
  ) {
    const actingRiderId = this.resolveRiderId(req.user as AuthenticatedActor, body.riderId);
    return this.logisticsService.verifyDeliveryOtp(
      tripId,
      actingRiderId,
      body.otp,
      body.proofPhotoUrl,
    );
  }

  @Post('trips/:id/reject')
  @Roles('RIDER', 'ADMIN', 'HUB_MANAGER')
  async rejectTrip(
    @Request() req: any,
    @Param('id') tripId: string,
    @Body() body: { riderId: string; reason: string },
  ) {
    const actingRiderId = this.resolveRiderId(req.user as AuthenticatedActor, body.riderId);
    return this.logisticsService.rejectTrip(tripId, actingRiderId, body.reason);
  }

  @Post('trips/:id/cancel')
  @Roles('ADMIN', 'HUB_MANAGER')
  async cancelTrip(@Param('id') tripId: string, @Body('reason') reason: string) {
    return this.logisticsService.cancelTrip(tripId, reason);
  }

  @Get('trips/rider/:riderId/active')
  @Roles('RIDER', 'ADMIN')
  async getRiderActiveTrip(@Request() req: any, @Param('riderId') riderId: string) {
    this.assertSelf(req.user as AuthenticatedActor, riderId);
    return this.logisticsService.getRiderActiveTrip(riderId);
  }

  @Get('trips/rider/:riderId/history')
  @Roles('RIDER', 'ADMIN')
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
