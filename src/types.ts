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

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
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
  status: 'ACCEPTED' | 'PREPARING' | 'READY';
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
}

export interface Coupon {
  code: string;
  description: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  minOrderValue: number;
  applicableBrandId?: BrandId;
}
