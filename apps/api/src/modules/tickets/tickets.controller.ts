import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Roles, AdminSubRoles } from '../../common/decorators/roles.decorator';
import { TicketStatus } from '@prisma/client';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * Derive the raiser from the authenticated principal.
   *
   * The request body used to supply `raisedById` and `raisedByType`, so any
   * caller could impersonate another customer or open tickets "as" a hub.
   */
  private raisedByTypeFor(role?: string): string {
    switch (role) {
      case 'RIDER':
        return 'RIDER';
      case 'HUB_STAFF':
      case 'HUB_MANAGER':
        return 'HUB';
      case 'BRAND_OPS':
        return 'BRAND_OPS';
      case 'ADMIN':
        return 'ADMIN';
      default:
        return 'CUSTOMER';
    }
  }

  /**
   * Create a new support ticket
   * Any authenticated user can create a ticket
   */
  @Post()
  @Roles('CUSTOMER', 'RIDER', 'HUB_STAFF', 'HUB_MANAGER', 'BRAND_OPS', 'ADMIN')
  async createTicket(
    @Request() req: any,
    @Body()
    body: {
      orderId?: string;
      category: string;
      priority?: string;
    },
  ) {
    const actor = req.user as AuthenticatedActor;
    return this.ticketsService.createTicket(
      {
        raisedByType: this.raisedByTypeFor(actor?.role),
        raisedById: actor.sub,
        orderId: body.orderId,
        category: body.category || 'OTHER',
        priority: body.priority || 'NORMAL',
      },
      actor,
    );
  }

  /**
   * Get all tickets (admin only, with optional filters)
   */
  @Get()
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getTickets(
    @Query('status') status?: TicketStatus,
    @Query('category') category?: string,
    @Query('assignedToId') assignedToId?: string,
  ) {
    return this.ticketsService.getTickets({ status, category, assignedToId });
  }

  /**
   * Get ticket statistics (admin only)
   */
  @Get('stats')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getTicketStats() {
    return this.ticketsService.getTicketStats();
  }

  /**
   * Get tickets for a specific user
   */
  @Get('user/:userId')
  @Roles('CUSTOMER', 'RIDER', 'HUB_STAFF', 'HUB_MANAGER', 'BRAND_OPS', 'ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getUserTickets(@Request() req: any, @Param('userId') userId: string) {
    return this.ticketsService.getUserTickets(
      userId,
      req.user as AuthenticatedActor,
    );
  }

  /**
   * Get ticket by ID
   */
  @Get(':id')
  @Roles('CUSTOMER', 'RIDER', 'HUB_STAFF', 'HUB_MANAGER', 'BRAND_OPS', 'ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getTicketById(@Request() req: any, @Param('id') id: string) {
    return this.ticketsService.getTicketById(
      id,
      req.user as AuthenticatedActor,
    );
  }

  /**
   * Assign ticket to support staff (admin only)
   */
  @Patch(':id/assign')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'SUPER_ADMIN')
  async assignTicket(
    @Param('id') id: string,
    @Body('staffId') staffId: string,
  ) {
    return this.ticketsService.assignTicket(id, staffId);
  }

  /**
   * Update ticket status (admin only)
   */
  @Patch(':id/status')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'SUPER_ADMIN')
  async updateTicketStatus(
    @Param('id') id: string,
    @Body('status') status: TicketStatus,
  ) {
    return this.ticketsService.updateTicketStatus(id, status);
  }

  /**
   * Resolve ticket with resolution note (admin only)
   */
  @Patch(':id/resolve')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'SUPER_ADMIN')
  async resolveTicket(
    @Param('id') id: string,
    @Body('resolutionNote') resolutionNote: string,
  ) {
    return this.ticketsService.resolveTicket(id, resolutionNote);
  }
}
