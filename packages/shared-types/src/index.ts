import { z } from 'zod';

// Zod validation schemas
export const RequestOtpSchema = z.object({
  email: z.string().email('Invalid email address format'),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export const CreateOrderSchema = z.object({
  userId: z.string(),
  hubId: z.string(),
  addressId: z.string(),
  items: z.array(
    z.object({
      menuItemId: z.string(),
      brandKitchenId: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
      customizations: z.record(z.any()).optional(),
    }),
  ).min(1, 'Cart cannot be empty'),
  paymentMethod: z.enum(['RAZORPAY', 'WALLET', 'COD']),
});

export const CreateRiderSchema = z.object({
  phone: z.string().min(10),
  name: z.string().min(2),
  vehicleType: z.enum(['BIKE', 'SCOOTER', 'BICYCLE']),
  vehicleRegNo: z.string().optional(),
  licenceDocUrl: z.string().optional(),
  vehicleRcDocUrl: z.string().optional(),
  bankAccountRef: z.string().optional(),
  upiId: z.string().optional(),
});

export const UpdateRiderStatusSchema = z.object({
  status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'SUSPENDED', 'REJECTED']),
  reason: z.string().optional(),
});

export const CreateTicketSchema = z.object({
  raisedByType: z.enum(['CUSTOMER', 'HUB', 'BRAND_OPS', 'RIDER']),
  raisedById: z.string(),
  orderId: z.string().optional(),
  category: z.enum(['MISSING_ITEM', 'WRONG_ITEM', 'LATE_DELIVERY', 'PAYMENT_ISSUE', 'RIDER_SAFETY', 'OTHER']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
});

export const UpdateTicketSchema = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  assignedToId: z.string().optional(),
  resolutionNote: z.string().optional(),
});

export const RiderLocationUpdateSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const DeliveryOtpVerifySchema = z.object({
  tripId: z.string(),
  otp: z.string().length(4, 'Delivery OTP must be 4 digits'),
});

export type RequestOtpDto = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
export type CreateOrderInputDto = z.infer<typeof CreateOrderSchema>;
export type CreateRiderDto = z.infer<typeof CreateRiderSchema>;
export type UpdateRiderStatusDto = z.infer<typeof UpdateRiderStatusSchema>;
export type CreateTicketDto = z.infer<typeof CreateTicketSchema>;
export type UpdateTicketDto = z.infer<typeof UpdateTicketSchema>;
export type RiderLocationUpdateDto = z.infer<typeof RiderLocationUpdateSchema>;
export type DeliveryOtpVerifyDto = z.infer<typeof DeliveryOtpVerifySchema>;

export type UserRole = 'CUSTOMER' | 'HUB_STAFF' | 'HUB_MANAGER' | 'BRAND_OPS' | 'RIDER' | 'ADMIN';
export type AdminSubRole = 'SUPER_ADMIN' | 'OPERATIONS_ADMIN' | 'FINANCE_ADMIN' | 'SUPPORT_ADMIN' | 'MARKETING_ADMIN';
export type RiderStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type TicketStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TripStatus =
  | 'UNASSIGNED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'ARRIVED_AT_HUB'
  | 'PICKED_UP'
  | 'ARRIVING'
  | 'DELIVERED'
  | 'STALE'
  | 'CANCELLED';
export type OrderStatus = 'PENDING_CONFIRMATION' | 'PLACED' | 'ACCEPTED_BY_KITCHEN' | 'PREPARING' | 'RIDER_ASSIGNED' | 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type BrandOrderStatus = 'SENT_TO_KITCHEN' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED';

