export type BrandId = 
  | 'box8' 
  | 'mojo-pizza' 
  | 'zaza-biryani' 
  | 'leancrust' 
  | 'wefit' 
  | 'mealful-rolls' 
  | 'nh1-bowls' 
  | 'zulus-pizza'
  | 'itminaan-biryani'
  | string;

export interface Brand {
  id: BrandId;
  name: string;
  tagline: string;
  logo: string;
  heroImage: string;
  themeColor: string; // Hex color for brand accent
  rating: number;
  totalRatings: number;
  deliveryTimeMins: number;
  minOrderValue: number;
  categories: string[];
  isAvailable: boolean;
  isOwned: boolean;        // SDD §7.1: default true (1st party vs 3rd party/franchise)
  commissionPct?: number;  // Optional commission percentage cut for 3rd party marketplace brands
}

export interface CustomizationOption {
  id: string;
  name: string;
  price: number;
  isVeg: boolean;
}

export interface CustomizationGroup {
  id: string;
  title: string;
  required: boolean;
  maxSelection?: number;
  options: CustomizationOption[];
}

export interface MenuItem {
  id: string;
  brandId: BrandId;
  availableHubIds: string[]; // Hubs (cloud kitchens) that can fulfill this item
  name: string;
  description: string;
  mrp: number; // Regular Maximum Retail Price
  memberPrice: number; // Discounted Price for Eatclub Members
  image: string;
  isVeg: boolean;
  isBestseller?: boolean;
  category: string;
  rating: number;
  dietType?: 'VEG' | 'NON_VEG' | 'EGG' | 'JAIN';
  spiceLevel?: number;
  gstPct?: number;
  variants?: Array<{ name: string; priceInPaise: number }>;
  addOns?: Array<{ name: string; priceInPaise: number }>;
  scheduledFrom?: string;
  scheduledTo?: string;
  customizationGroups?: CustomizationGroup[];
  isAvailable: boolean;
}

export interface CartItemOption {
  groupId: string;
  groupTitle: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface CartItem {
  cartItemId: string; // Unique GUID for this specific line item + customization
  item: MenuItem;
  quantity: number;
  selectedOptions: CartItemOption[];
  unitPrice: number;
  totalPrice: number;
}

export interface SavedAddress {
  id: string;
  type: 'home' | 'work' | 'other';
  label: string;
  addressLine: string;
  landmark?: string;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
  resolvedHubId: string;
  isDefault?: boolean;
}

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

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role?: UserRole;
  adminSubRole?: AdminSubRole;
  scopedHubId?: string;
  scopedBrandId?: string;
  isMember: boolean;
  membershipPlan?: {
    type: 'trial' | 'quarterly' | 'annual';
    expiresAt: string;
    totalSavingsToDate: number;
  };
  walletBalance: number;
  referralCode: string;
  savedAddresses: SavedAddress[];
}

export type OrderStatus = 
  | 'PENDING_CONFIRMATION'
  | 'PLACED' 
  | 'ACCEPTED_BY_KITCHEN' 
  | 'PREPARING' 
  | 'RIDER_ASSIGNED' 
  | 'PICKED_UP' 
  | 'OUT_FOR_DELIVERY' 
  | 'DELIVERED' 
  | 'CANCELLED';

export interface BrandOrderStatus {
  brandId: BrandId;
  brandName: string;
  status: 'SENT_TO_KITCHEN' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED';
  itemsCount: number;
}

export interface Order {
  id: string;
  createdAt: string;
  items: CartItem[];
  deliveryAddress: SavedAddress;
  status: OrderStatus;
  brandStatuses: BrandOrderStatus[];
  mrpTotal: number;
  memberSavings: number;
  deliveryFee: number;
  packagingFee: number;
  platformFee: number;
  tax: number;
  walletDiscount: number;
  couponDiscount: number;
  finalPaidAmount: number;
  paymentMethod: 'UPI' | 'CARD' | 'WALLET' | 'COD';
  estimatedDeliveryMins: number;
  rider?: {
    name: string;
    phone: string;
    rating: number;
    currentLat: number;
    currentLng: number;
  };
  /** Customer-only handover code, present once the rider has picked up. */
  deliveryOtp?: string | null;
}

export interface Rider {
  id: string;
  phone: string;
  name: string;
  status: RiderStatus;
  vehicleType: string;
  vehicleRegNo?: string;
  licenceDocUrl?: string;
  vehicleRcDocUrl?: string;
  bankAccountRef?: string;
  upiId?: string;
  isOnline: boolean;
  liveLat?: number;
  liveLng?: number;
  currentHubId?: string;
  capacityMax: number;
  rating?: number;
  createdAt: string;
  approvedAt?: string;
}

export interface RiderEarning {
  id: string;
  riderId: string;
  tripId?: string;
  type: 'BASE_FEE' | 'DISTANCE_FEE' | 'SURGE' | 'TIP' | 'INCENTIVE' | 'PENALTY' | 'PAYOUT';
  amountInPaise: number;
  createdAt: string;
}

export interface Ticket {
  id: string;
  raisedByType: 'CUSTOMER' | 'HUB' | 'BRAND_OPS' | 'RIDER';
  raisedById: string;
  orderId?: string;
  category: 'MISSING_ITEM' | 'WRONG_ITEM' | 'LATE_DELIVERY' | 'PAYMENT_ISSUE' | 'RIDER_SAFETY' | 'OTHER';
  status: TicketStatus;
  assignedToId?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  resolutionNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface Coupon {
  code: string;
  description: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  minOrderValue: number;
  applicableBrandId?: BrandId;
}

