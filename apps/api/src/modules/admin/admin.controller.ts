import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles, AdminSubRoles } from '../../common/decorators/roles.decorator';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Admin Dashboard high-level KPIs
   */
  @Get('dashboard/kpis')
  @Roles('ADMIN')
  @AdminSubRoles(
    'OPERATIONS_ADMIN',
    'FINANCE_ADMIN',
    'SUPPORT_ADMIN',
    'MARKETING_ADMIN',
    'SUPER_ADMIN',
  )
  async getDashboardKPIs() {
    return this.adminService.getDashboardKPIs();
  }

  /**
   * Admin Dashboard live order tracking
   */
  @Get('dashboard/live-orders')
  @Roles('ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getLiveOrdersMap() {
    return this.adminService.getLiveOrdersMap();
  }

  /**
   * Search & list platform users
   */
  @Get('users')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN')
  async getUsers(@Query('search') search?: string) {
    return this.adminService.getUsers({ search });
  }

  /**
   * Get user detail page (order history, wallet, membership)
   */
  @Get('users/:id')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN')
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  /**
   * Adjust user wallet balance
   */
  @Post('users/:id/wallet-adjust')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN')
  async adjustWallet(
    @Request() req: any,
    @Param('id') id: string,
    @Body('amountInPaise') amountInPaise: number,
    @Body('reason') reason: string,
  ) {
    return this.adminService.adjustWallet(
      id,
      amountInPaise,
      reason,
      req.user?.sub,
    );
  }

  /**
   * List platform orders with filters
   */
  @Get('orders')
  @Roles('ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN')
  async getOrders(
    @Query('status') status?: string,
    @Query('hubId') hubId?: string,
  ) {
    return this.adminService.getOrders({ status, hubId });
  }

  /**
   * Manually reassign rider for an order trip
   */
  @Post('orders/:id/reassign-rider')
  @Roles('ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async manuallyReassignRider(
    @Param('id') orderId: string,
    @Body('riderId') riderId: string,
  ) {
    return this.adminService.manuallyReassignRider(orderId, riderId);
  }

  /**
   * Dashboard: Order distribution across brands and hubs
   */
  @Get('dashboard/order-distribution')
  @Roles('ADMIN')
  @AdminSubRoles(
    'OPERATIONS_ADMIN',
    'FINANCE_ADMIN',
    'MARKETING_ADMIN',
    'SUPER_ADMIN',
  )
  async getOrderDistribution() {
    return this.adminService.getOrderDistribution();
  }

  /**
   * Dashboard: Revenue trend over 7 days
   */
  @Get('dashboard/revenue-trend')
  @Roles('ADMIN')
  @AdminSubRoles('FINANCE_ADMIN', 'SUPER_ADMIN')
  async getRevenueTrend() {
    return this.adminService.getRevenueTrend();
  }

  /**
   * User Management: Block/unblock user
   */
  @Patch('users/:id/block')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'SUPER_ADMIN')
  async blockUser(
    @Param('id') id: string,
    @Body('blocked') blocked: boolean,
  ) {
    return this.adminService.blockUser(id, blocked);
  }

  /**
   * User Management: DPDP Anonymization/Deletion
   */
  @Delete('users/:id')
  @Roles('ADMIN')
  @AdminSubRoles('SUPER_ADMIN')
  async deleteUserData(@Param('id') id: string) {
    return this.adminService.deleteUserData(id);
  }

  /**
   * Hub Management: Create Hub
   */
  @Post('hubs')
  @Roles('ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async createHub(@Body() body: any) {
    return this.adminService.createHub(body);
  }

  /**
   * Hub Management: Update Hub
   */
  @Patch('hubs/:id')
  @Roles('ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async updateHub(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateHub(id, body);
  }

  /**
   * Hub Management: Assign Staff
   */
  @Post('hubs/:id/assign-staff')
  @Roles('ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async assignStaffToHub(
    @Param('id') hubId: string,
    @Body('userId') userId: string,
    @Body('role') role: 'HUB_STAFF' | 'HUB_MANAGER',
  ) {
    return this.adminService.assignStaffToHub(hubId, userId, role);
  }

  /**
   * Brand Management: Create Brand
   */
  @Post('brands')
  @Roles('ADMIN')
  @AdminSubRoles('SUPER_ADMIN')
  async createBrand(@Body() body: any) {
    return this.adminService.createBrand(body);
  }

  /**
   * Brand Management: Update Brand
   */
  @Patch('brands/:id')
  @Roles('ADMIN')
  @AdminSubRoles('SUPER_ADMIN')
  async updateBrand(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateBrand(id, body);
  }

  /**
   * Brand Management: Assign Ops Manager
   */
  @Post('brands/:id/assign-ops')
  @Roles('ADMIN')
  @AdminSubRoles('SUPER_ADMIN')
  async assignBrandOps(
    @Param('id') brandId: string,
    @Body('userId') userId: string,
  ) {
    return this.adminService.assignBrandOps(brandId, userId);
  }

  /**
   * Finance: Transactions
   */
  @Get('finance/transactions')
  @Roles('ADMIN')
  @AdminSubRoles('FINANCE_ADMIN', 'SUPER_ADMIN')
  async getFinanceTransactions(@Query('limit') limit?: string) {
    return this.adminService.getFinanceTransactions({ limit: limit ? parseInt(limit, 10) : 50 });
  }

  /**
   * Finance: Rider Payouts Ledger
   */
  @Get('finance/rider-payouts')
  @Roles('ADMIN')
  @AdminSubRoles('FINANCE_ADMIN', 'SUPER_ADMIN')
  async getRiderPayouts() {
    return this.adminService.getRiderPayouts();
  }

  /**
   * Finance: Batch Payouts
   */
  @Post('finance/rider-payouts/batch')
  @Roles('ADMIN')
  @AdminSubRoles('FINANCE_ADMIN', 'SUPER_ADMIN')
  async processBatchRiderPayouts(@Body('riderIds') riderIds: string[]) {
    return this.adminService.processBatchRiderPayouts(riderIds);
  }

  /**
   * Finance: Revenue Report
   */
  @Get('finance/revenue-report')
  @Roles('ADMIN')
  @AdminSubRoles('FINANCE_ADMIN', 'SUPER_ADMIN')
  async getRevenueReport() {
    return this.adminService.getRevenueReport();
  }

  /**
   * Staff Management: Get Staff
   */
  @Get('staff')
  @Roles('ADMIN')
  @AdminSubRoles('SUPER_ADMIN')
  async getStaff() {
    return this.adminService.getStaff();
  }

  /**
   * Staff Management: Create Staff
   */
  @Post('staff')
  @Roles('ADMIN')
  @AdminSubRoles('SUPER_ADMIN')
  async createStaff(@Request() req: any, @Body() body: any) {
    return this.adminService.createStaff(body, req.user?.sub);
  }

  /**
   * Finance: refund a captured payment
   */
  @Post('orders/:id/refund')
  @Roles('ADMIN')
  @AdminSubRoles('FINANCE_ADMIN', 'SUPER_ADMIN')
  async refundOrder(
    @Request() req: any,
    @Param('id') orderId: string,
    @Body('amountInPaise') amountInPaise?: number,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.refundOrder(orderId, amountInPaise, reason || '', req.user?.sub);
  }

  /**
   * Marketing: promotion approval queue
   */
  @Get('promotions')
  @Roles('ADMIN')
  @AdminSubRoles('MARKETING_ADMIN', 'SUPER_ADMIN')
  async getPromotions() {
    return this.adminService.getPromotions();
  }

  @Patch('promotions/:id/status')
  @Roles('ADMIN')
  @AdminSubRoles('MARKETING_ADMIN', 'SUPER_ADMIN')
  async setPromotionStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: 'APPROVED' | 'REJECTED',
  ) {
    return this.adminService.setPromotionStatus(id, status, req.user?.sub);
  }

  /**
   * Audit Logs: Query
   */
  @Get('audit-log')
  @Roles('ADMIN')
  @AdminSubRoles('FINANCE_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAuditLogs({
      action,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }
}
