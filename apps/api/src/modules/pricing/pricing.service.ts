import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CalculatePriceInput {
  items: { price: number; quantity: number }[];
  isMember: boolean;
  couponCode?: string;
  useWalletBalance?: number;
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateCartPrice(input: CalculatePriceInput) {
    const itemTotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Delivery & Packaging Fees
    const baseDeliveryFee = 45;
    const basePackagingFee = 25;

    // Membership benefits: 30% off, ₹0 delivery, ₹0 packaging
    const memberDiscount = input.isMember ? Math.round(itemTotal * 0.3) : 0;
    const deliveryFee = input.isMember ? 0 : baseDeliveryFee;
    const packagingFee = input.isMember ? 0 : basePackagingFee;

    // Coupon discount
    let couponDiscount = 0;
    if (input.couponCode) {
      if (input.couponCode.toUpperCase() === 'CRAVE50') {
        couponDiscount = Math.min(50, itemTotal * 0.15);
      } else if (input.couponCode.toUpperCase() === 'WELCOME100') {
        couponDiscount = 100;
      }
    }

    // Subtotal before wallet
    const subtotal = Math.max(0, itemTotal - memberDiscount - couponDiscount + deliveryFee + packagingFee);

    // Taxes (5% GST on food)
    const taxes = Math.round(subtotal * 0.05);

    // Final total before wallet deduction
    const grossTotal = subtotal + taxes;

    // Wallet deduction
    const walletApplied = Math.min(input.useWalletBalance || 0, grossTotal);
    const finalPayable = Math.max(0, grossTotal - walletApplied);

    return {
      itemTotal,
      memberDiscount,
      couponDiscount,
      deliveryFee,
      packagingFee,
      taxes,
      grossTotal,
      walletApplied,
      finalPayable,
      savingsSummary: {
        memberDiscountSaved: memberDiscount,
        deliverySaved: input.isMember ? baseDeliveryFee : 0,
        packagingSaved: input.isMember ? basePackagingFee : 0,
        totalSaved: memberDiscount + (input.isMember ? baseDeliveryFee + basePackagingFee : 0) + couponDiscount,
      },
    };
  }
}
