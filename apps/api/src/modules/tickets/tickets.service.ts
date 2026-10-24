import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderTrackingGateway } from '../websockets/websockets.gateway';
import { TicketStatus } from '@prisma/client';

interface CreateTicketDto {
  raisedByType: string; // CUSTOMER / HUB / BRAND_OPS / RIDER
  raisedById: string;
  orderId?: string;
  category: string;
  priority?: string;
}

interface TicketFilters {
  status?: TicketStatus;
  category?: string;
  assignedToId?: string;
  raisedById?: string;
}

export interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  avgResolutionTimeHours?: number;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketsGateway: OrderTrackingGateway,
  ) {}

  /**
   * Create a new support ticket
   */
  async createTicket(data: CreateTicketDto) {
    const ticket = await this.prisma.ticket.create({
      data: {
        raisedByType: data.raisedByType,
        raisedById: data.raisedById,
        orderId: data.orderId,
        category: data.category,
        status: 'OPEN',
        priority: data.priority || 'NORMAL',
      },
    });

    // Emit WebSocket event to admin tickets room
    this.websocketsGateway.server.to('admin:tickets').emit('ticketCreated', ticket);

    this.logger.log(`🎫 New ticket created: ${ticket.id} by ${data.raisedByType} ${data.raisedById}`);

    return ticket;
  }

  /**
   * Get all tickets with optional filters
   */
  async getTickets(filters?: TicketFilters) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.assignedToId) {
      where.assignedToId = filters.assignedToId;
    }

    if (filters?.raisedById) {
      where.raisedById = filters.raisedById;
    }

    return this.prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return ticket;
  }

  /**
   * Assign ticket to a support staff member
   */
  async assignTicket(id: string, staffId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      throw new ForbiddenException(`Cannot assign ticket in status ${ticket.status}`);
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: {
        assignedToId: staffId,
        status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
      },
    });

    // Emit WebSocket event to assigned staff member
    this.websocketsGateway.server.to(`user:${staffId}`).emit('ticketAssigned', updatedTicket);

    this.logger.log(`🎫 Ticket ${id} assigned to staff ${staffId}`);

    return updatedTicket;
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(id: string, status: TicketStatus) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: { status },
    });

    // Emit WebSocket event to ticket raiser
    this.websocketsGateway.server
      .to(`user:${ticket.raisedById}`)
      .emit('ticketStatusUpdated', updatedTicket);

    this.logger.log(`🎫 Ticket ${id} status updated to ${status}`);

    return updatedTicket;
  }

  /**
   * Resolve ticket with a resolution note
   */
  async resolveTicket(id: string, resolutionNote: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    if (ticket.status === 'CLOSED') {
      throw new ForbiddenException('Cannot resolve a closed ticket');
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolutionNote,
        resolvedAt: new Date(),
      },
    });

    // Emit WebSocket event to ticket raiser
    this.websocketsGateway.server.to(`user:${ticket.raisedById}`).emit('ticketResolved', updatedTicket);

    this.logger.log(`✅ Ticket ${id} resolved`);

    return updatedTicket;
  }

  /**
   * Get all tickets for a specific user / raiser
   */
  async getUserTickets(userId: string) {
    return this.prisma.ticket.findMany({
      where: { raisedById: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get ticket statistics for admin dashboard
   */
  async getTicketStats(): Promise<TicketStats> {
    const tickets = await this.prisma.ticket.findMany({
      select: {
        status: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    const total = tickets.length;
    const open = tickets.filter((t) => t.status === 'OPEN').length;
    const inProgress = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
    const resolved = tickets.filter((t) => t.status === 'RESOLVED').length;
    const closed = tickets.filter((t) => t.status === 'CLOSED').length;

    // Calculate average resolution time
    const resolvedTickets = tickets.filter((t) => t.resolvedAt);
    let avgResolutionTimeHours: number | undefined;

    if (resolvedTickets.length > 0) {
      const totalResolutionTime = resolvedTickets.reduce((sum, ticket) => {
        const resolutionTime =
          ticket.resolvedAt!.getTime() - ticket.createdAt.getTime();
        return sum + resolutionTime;
      }, 0);

      avgResolutionTimeHours = totalResolutionTime / resolvedTickets.length / (1000 * 60 * 60);
    }

    return {
      total,
      open,
      inProgress,
      resolved,
      closed,
      avgResolutionTimeHours: avgResolutionTimeHours
        ? Math.round(avgResolutionTimeHours * 10) / 10
        : undefined,
    };
  }
}
