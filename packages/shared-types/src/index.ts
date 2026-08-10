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
  userId: z.string().uuid(),
  hubId: z.string().uuid(),
  addressId: z.string().uuid(),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      brandKitchenId: z.string().uuid(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
      customizations: z.record(z.any()).optional(),
    }),
  ).min(1, 'Cart cannot be empty'),
  paymentMethod: z.enum(['RAZORPAY', 'WALLET', 'COD']),
});

export type RequestOtpDto = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
export type CreateOrderInputDto = z.infer<typeof CreateOrderSchema>;

export type UserRole = 'CUSTOMER' | 'HUB_STAFF' | 'BRAND_OPS' | 'RIDER' | 'ADMIN';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
export type BrandOrderStatus = 'RECEIVED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED';
