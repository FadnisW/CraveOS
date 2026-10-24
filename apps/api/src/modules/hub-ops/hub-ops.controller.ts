import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
} from '@nestjs/common';
import { HubOpsService } from './hub-ops.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

@Controller('hub-ops')
export class HubOpsController {
  constructor(private readonly hubOpsService: HubOpsService) {}

  /**
   * Hubs the current operator is allowed to work in. The KDS and dispatch
   * consoles need a real hub picker instead of a hardcoded seed id.
   */
  @Get('hubs')
  @Roles('HUB_STAFF', 'HUB_MANAGER', 'BRAND_OPS', 'ADMIN')
  async listHubs(@Request() req: any) {
    return this.hubOpsService.listHubs(req.user as AuthenticatedActor);
  }

  /**
   * Hub Dashboard (§5.1)
   */
  @Get(':hubId/dashboard')
  @Roles('HUB_MANAGER', 'ADMIN')
  async getHubDashboard(@Param('hubId') hubId: string) {
    return this.hubOpsService.getHubDashboard(hubId);
  }

  /**
   * Hub Stock & 86 Catalog (§5.1)
   */
  @Get(':hubId/stock')
  @Roles('HUB_STAFF', 'HUB_MANAGER', 'ADMIN')
  async getHubStock(@Param('hubId') hubId: string) {
    return this.hubOpsService.getHubStock(hubId);
  }

  /**
   * Bulk 86 Toggle (§5.1)
   */
  @Patch(':hubId/stock/bulk-86')
  @Roles('HUB_STAFF', 'HUB_MANAGER', 'ADMIN')
  async bulkToggle86(
    @Param('hubId') hubId: string,
    @Body('updates') updates: { menuItemId: string; isAvailable: boolean }[],
  ) {
    return this.hubOpsService.bulkToggle86(hubId, updates);
  }

  /**
   * Hub Staff Directory (§5.1)
   */
  @Get(':hubId/staff')
  @Roles('HUB_MANAGER', 'ADMIN')
  async getHubStaff(@Param('hubId') hubId: string) {
    return this.hubOpsService.getHubStaff(hubId);
  }

  /**
   * Assign Staff to Hub (§5.1)
   */
  @Post(':hubId/staff/assign')
  @Roles('HUB_MANAGER', 'ADMIN')
  async assignStaff(
    @Param('hubId') hubId: string,
    @Body('userId') userId: string,
    @Body('role') role: 'HUB_STAFF' | 'HUB_MANAGER',
  ) {
    return this.hubOpsService.assignStaff(hubId, userId, role);
  }

  /**
   * Hub Financial Overview (§5.1)
   */
  @Get(':hubId/finance')
  @Roles('HUB_MANAGER', 'ADMIN')
  async getHubFinance(@Param('hubId') hubId: string) {
    return this.hubOpsService.getHubFinance(hubId);
  }

  /**
   * Hub Staged Fleet (§5.1)
   */
  @Get(':hubId/riders')
  @Roles('HUB_MANAGER', 'ADMIN')
  async getHubRiders(@Param('hubId') hubId: string) {
    return this.hubOpsService.getHubRiders(hubId);
  }

  /**
   * Live KDS ticket board (§5.1)
   */
  @Get(':hubId/kds/tickets')
  @Roles('HUB_STAFF', 'HUB_MANAGER', 'ADMIN', 'BRAND_OPS')
  async getHubKdsTickets(@Request() req: any, @Param('hubId') hubId: string) {
    return this.hubOpsService.getHubKdsTickets(hubId, req.user as AuthenticatedActor);
  }

  /**
   * Confirm Rider Packet Handoff (§5.1)
   */
  @Post(':hubId/rider-handoff/:tripId')
  @Roles('HUB_STAFF', 'HUB_MANAGER', 'ADMIN')
  async confirmRiderHandoff(
    @Param('hubId') hubId: string,
    @Param('tripId') tripId: string,
  ) {
    return this.hubOpsService.confirmRiderHandoff(hubId, tripId);
  }
}
