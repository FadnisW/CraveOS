import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderTrackingGateway } from '../websockets/websockets.gateway';
import { TicketStatus } from '@prisma/client';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

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
   * A ticket may only reference an order the raiser can actually see.
   */
  private async assertOrderAccess(orderId: string, actor: AuthenticatedActor) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        deliveryTrip: { select: { riderId: true } },
        brandOrders: { select: { brandId: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (actor.role === 'ADMIN') return;
    if (actor.role === 'CUSTOMER' && order.userId === actor.sub) return;
    if (actor.role === 'RIDER' && order.deliveryTrip?.riderId === actor.sub) return;
    if (
      (actor.role === 'HUB_STAFF' || actor.role === 'HUB_MANAGER') &&
      actor.scopedHubId === order.hubId
    ) {
      return;
    }
    if (
      actor.role === 'BRAND_OPS' &&
      actor.scopedBrandId &&
      order.brandOrders.some((bo) => bo.brandId === actor.scopedBrandId)
    ) {
      return;
    }

    throw new ForbiddenException('This order does not belong to you');
  }

  /**
   * Create a new support ticket
   */
  async createTicket(data: CreateTicketDto, actor: AuthenticatedActor) {
    const category = String(data?.category || '').trim().toUpperCase();
    if (!category) {
      throw new BadRequestException('A ticket category is required');
    }

    if (data.orderId) {
      await this.assertOrderAccess(data.orderId, actor);
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        raisedByType: data.raisedByType,
        raisedById: data.raisedById,
        orderId: data.orderId,
        category,
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
  async getTicketById(id: string, actor: AuthenticatedActor) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    // Admins can read every ticket; everyone else can only read their own.
    if (actor?.role !== 'ADMIN' && ticket.raisedById !== actor?.sub) {
      throw new ForbiddenException('This ticket does not belong to you');
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

    // A ticket may only be assigned to a support/operations admin. Without
    // this, any user id (including a customer's) could be supplied and the
    // ticket payload would be emitted into that user's socket room.
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      select: { id: true, role: true, adminSubRole: true },
    });
    if (!staff || staff.role !== 'ADMIN') {
      throw new BadRequestException('Tickets can only be assigned to admin staff');
    }
    if (
      !['SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN'].includes(
        staff.adminSubRole || '',
      )
    ) {
      throw new BadRequestException(
        'Tickets can only be assigned to support, operations, or super admins',
      );
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: {
        assignedToId: staffId,
        // Assignment is its own state. Jumping straight to IN_PROGRESS skipped
        // ASSIGNED entirely, so the queue could never show "assigned, not yet
        // started" and the status history was wrong.
        status: ticket.status === 'OPEN' ? 'ASSIGNED' : ticket.status,
      },
    });

    // Emit WebSocket event to assigned staff member
    this.websocketsGateway.server.to(`user:${staffId}`).emit('ticketAssigned', updatedTicket);

    this.logger.log(`🎫 Ticket ${id} assigned to staff ${staffId}`);

    return updatedTicket;
  }

  /**
   * Legal status transitions. Assignment and resolution have their own
   * endpoints, so this map only guards the explicit status route. Without it
   * any caller could reopen a CLOSED ticket or skip straight from OPEN to
   * RESOLVED, which broke the queue counts and the audit trail.
   */
  private static readonly ALLOWED_STATUS_TRANSITIONS: Record<
    TicketStatus,
    TicketStatus[]
  > = {
    OPEN: ['ASSIGNED', 'CLOSED'],
    ASSIGNED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    IN_PROGRESS: ['RESOLVED', 'CLOSED'],
    RESOLVED: ['CLOSED'],
    CLOSED: [],
  };

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

    const allowed = TicketsService.ALLOWED_STATUS_TRANSITIONS[ticket.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot move ticket from ${ticket.status} to ${status}`,
      );
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
  async getUserTickets(userId: string, actor: AuthenticatedActor) {
    if (actor?.role !== 'ADMIN' && userId !== actor?.sub) {
      throw new ForbiddenException('You can only view your own tickets');
    }

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
