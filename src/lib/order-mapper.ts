import {
  BrandOrderStatus,
  CartItem,
  Order,
  OrderStatus,
  SavedAddress,
} from '../types';

/**
 * The API returns paise, Prisma enums and nested brand tickets. The storefront
 * speaks rupees, lowercase address types and a flat Order shape. Keeping that
 * translation in one place stops every screen from inventing its own fallbacks.
 */

type ApiRider = {
  id: string;
  name: string;
  phone: string;
  rating?: number | null;
  liveLat?: number | null;
  liveLng?: number | null;
  vehicleType?: string | null;
};

type ApiAddress = {
  id: string;
  type?: string;
  label?: string;
  addressLine: string;
  landmark?: string | null;
  city?: string;
  pincode?: string;
  lat: number;
  lng: number;
  resolvedHubId?: string;
  isDefault?: boolean;
};

type ApiOrderItem = {
  id: string;
  menuItemId: string;
  nameSnapshot: string;
  mrpSnapshot?: number;
  priceSnapshot: number;
  quantity: number;
};

type ApiBrandOrder = {
  id: string;
  brandId: string;
  status: string;
  items: ApiOrderItem[];
};

export type ApiOrder = {
  id: string;
  createdAt: string;
  status: string;
  paymentMethod?: string;
  mrpTotalPaise: number;
  memberSavingsPaise: number;
  deliveryFeePaise?: number;
  packagingFeePaise?: number;
  taxPaise: number;
  walletAppliedPaise?: number;
  finalPaidPaise: number;
  discountBreakdown?: { couponDiscount?: number } | null;
  brandOrders?: ApiBrandOrder[];
  address?: ApiAddress | null;
  hubId?: string;
  deliveryTrip?: {
    rider?: ApiRider | null;
    status?: string;
    deliveryOtp?: string | null;
  } | null;
};

const BRAND_STATUSES: BrandOrderStatus['status'][] = [
  'SENT_TO_KITCHEN',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'REJECTED',
];

const PAYMENT_METHODS = ['UPI', 'CARD', 'WALLET', 'COD'] as const;

function paiseToRupees(paise: number | null | undefined): number {
  return Math.round(Number(paise) || 0) / 100;
}

function mapAddress(address?: ApiAddress | null): SavedAddress {
  if (!address) {
    return {
      id: '',
      type: 'home',
      label: 'Delivery Address',
      addressLine: 'Address unavailable',
      city: 'Bengaluru',
      pincode: '',
      lat: 0,
      lng: 0,
      resolvedHubId: '',
    };
  }

  const type = String(address.type || 'home').toLowerCase();

  return {
    id: address.id,
    type: type === 'work' ? 'work' : type === 'other' ? 'other' : 'home',
    label: address.label || 'Delivery Address',
    addressLine: address.addressLine,
    landmark: address.landmark || undefined,
    city: address.city || 'Bengaluru',
    pincode: address.pincode || '',
    lat: address.lat,
    lng: address.lng,
    resolvedHubId: address.resolvedHubId || '',
    isDefault: address.isDefault,
  };
}

function mapCartItems(order: ApiOrder): CartItem[] {
  return (order.brandOrders || []).flatMap((brandOrder) =>
    (brandOrder.items || []).map((item) => {
      const unitPrice = paiseToRupees(item.priceSnapshot);
      const mrp = paiseToRupees(item.mrpSnapshot ?? item.priceSnapshot);

      return {
        cartItemId: item.id,
        item: {
          id: item.menuItemId,
          brandId: brandOrder.brandId,
          availableHubIds: order.hubId ? [order.hubId] : [],
          name: item.nameSnapshot,
          description: '',
          mrp,
          memberPrice: unitPrice,
          image: '',
          isVeg: true,
          category: '',
          rating: 4.5,
          isAvailable: true,
        },
        quantity: item.quantity,
        selectedOptions: [],
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      };
    }),
  );
}

export function mapApiOrder(order: ApiOrder): Order {
  const rider = order.deliveryTrip?.rider;
  const paymentMethod = PAYMENT_METHODS.includes(
    order.paymentMethod as (typeof PAYMENT_METHODS)[number],
  )
    ? (order.paymentMethod as Order['paymentMethod'])
    : 'UPI';

  return {
    id: order.id,
    createdAt: order.createdAt,
    items: mapCartItems(order),
    deliveryAddress: mapAddress(order.address),
    status: (order.status || 'PLACED') as OrderStatus,
    brandStatuses: (order.brandOrders || []).map((brandOrder) => ({
      brandId: brandOrder.brandId,
      brandName: brandOrder.brandId
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      status: BRAND_STATUSES.includes(brandOrder.status as BrandOrderStatus['status'])
        ? (brandOrder.status as BrandOrderStatus['status'])
        : 'SENT_TO_KITCHEN',
      itemsCount: (brandOrder.items || []).reduce((sum, item) => sum + item.quantity, 0),
    })),
    mrpTotal: paiseToRupees(order.mrpTotalPaise),
    memberSavings: paiseToRupees(order.memberSavingsPaise),
    deliveryFee: paiseToRupees(order.deliveryFeePaise),
    packagingFee: paiseToRupees(order.packagingFeePaise),
    platformFee: 0,
    tax: paiseToRupees(order.taxPaise),
    walletDiscount: paiseToRupees(order.walletAppliedPaise),
    couponDiscount: Number(order.discountBreakdown?.couponDiscount) || 0,
    finalPaidAmount: paiseToRupees(order.finalPaidPaise),
    paymentMethod,
    estimatedDeliveryMins: 25,
    rider: rider
      ? {
          name: rider.name,
          phone: rider.phone,
          rating: rider.rating ?? 5,
          currentLat: rider.liveLat ?? 0,
          currentLng: rider.liveLng ?? 0,
        }
      : undefined,
    deliveryOtp: order.deliveryTrip?.deliveryOtp || undefined,
  };
}

export function mapApiOrders(orders: ApiOrder[]): Order[] {
  return (orders || []).map(mapApiOrder);
}
