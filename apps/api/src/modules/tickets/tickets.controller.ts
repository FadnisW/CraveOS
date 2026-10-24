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

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * Create a new support ticket
   * Any authenticated user can create a ticket
   */
  @Post()
  @Roles('CUSTOMER', 'RIDER', 'HUB_STAFF', 'BRAND_OPS', 'ADMIN')
  async createTicket(
    @Body()
    body: {
      raisedByType?: string;
      raisedById?: string;
      userId?: string;
      orderId?: string;
      category: string;
      priority?: string;
    },
  ) {
    return this.ticketsService.createTicket({
      raisedByType: body.raisedByType || 'CUSTOMER',
      raisedById: body.raisedById || body.userId || 'UNKNOWN',
      orderId: body.orderId,
      category: body.category || 'OTHER',
      priority: body.priority || 'NORMAL',
    });
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
  async getTicketStats() {
    return this.ticketsService.getTicketStats();
  }

  /**
   * Get tickets for a specific user
   */
  @Get('user/:userId')
  @Roles('CUSTOMER', 'RIDER', 'ADMIN')
  async getUserTickets(@Param('userId') userId: string) {
    // TODO: Add ownership check - users should only see their own tickets
    // unless they are admin
    return this.ticketsService.getUserTickets(userId);
  }

  /**
   * Get ticket by ID
   */
  @Get(':id')
  @Roles('CUSTOMER', 'RIDER', 'ADMIN')
  async getTicketById(@Param('id') id: string) {
    // TODO: Add ownership check - users should only see their own tickets
    // unless they are admin
    return this.ticketsService.getTicketById(id);
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
