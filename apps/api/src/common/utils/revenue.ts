import { PrismaService } from '../prisma/prisma.service';

/**
 * Shared revenue accounting.
 *
 * Every console (admin, hub, brand) must agree on what "collected" means:
 *  - gateway money is collected when the payment row is SUCCESS;
 *  - wallet money is collected when it was debited (synthetic `wallet` payment);
 *  - refunds (wallet credit and gateway refunds) reduce collected revenue.
 *
 * Keeping this in one place stops the hub finance screen from reporting
 * `finalPaidPaise` for orders that were never paid.
 */

export interface RevenueOrderShape {
  status: string;
  paymentMethod: string;
  finalPaidPaise: number;
  walletAppliedPaise: number;
  payment?: {
    status: string;
    amountInPaise: number;
    gateway: string;
    refundedAmountPaise?: number;
  } | null;
}

export type PaymentGateway = 'RAZORPAY' | 'WALLET';

/** Sum of wallet refunds already issued per order. */
export async function getWalletRefundsByOrder(
  prisma: PrismaService,
): Promise<Map<string, number>> {
  const rows = await prisma.walletTransaction.groupBy({
    by: ['orderId'],
    where: {
      orderId: { not: null },
      reason: { in: ['ORDER_REFUND', 'PARTIAL_ORDER_REFUND'] },
    },
    _sum: { amountInPaise: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.orderId) map.set(row.orderId, row._sum.amountInPaise ?? 0);
  }
  return map;
}

/**
 * Money actually collected for an order, net of refunds.
 */
export function netCollectedPaise(
  order: RevenueOrderShape,
  walletRefundedPaise = 0,
): { collectedPaise: number; gateway: PaymentGateway } {
  let grossPaise = 0;
  let gateway: PaymentGateway = 'RAZORPAY';

  if (order.payment?.status === 'SUCCESS') {
    if (order.payment.gateway === 'wallet') {
      gateway = 'WALLET';
      grossPaise = order.payment.amountInPaise;
    } else {
      gateway = 'RAZORPAY';
      grossPaise = order.payment.amountInPaise + order.walletAppliedPaise;
    }
  }

  const gatewayRefundedPaise = order.payment?.refundedAmountPaise ?? 0;
  return {
    collectedPaise: Math.max(0, grossPaise - walletRefundedPaise - gatewayRefundedPaise),
    gateway,
  };
}

/**
 * Local calendar day key (`YYYY-MM-DD`).
 *
 * `toISOString()` is UTC, which shifts every IST order after 05:30 into the
 * previous day and makes the revenue chart disagree with the operator's date.
 */
export function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
