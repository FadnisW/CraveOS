export type TabType = 'home' | 'search' | 'deals' | 'orders' | 'profile' | 'restaurant' | 'checkout';

export interface FoodItem {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  isVeg: boolean;
  isBestseller?: boolean;
  category: string;
  restaurantId: string;
  portions?: { name: string; price: number }[];
  addons?: { id: string; name: string; price: number; description?: string }[];
}

export interface Restaurant {
  id: string;
  name: string;
  tagline: string;
  image: string;
  rating?: number;
  deliveryTime?: string;
  unavailable?: boolean;
  unavailableMessage?: string;
  cuisine: string[];
  discountText?: string;
}

export interface Offer {
  id: string;
  title: string;
  image: string;
  priceText: string;
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string;
  discountText: string;
  validOn: string;
  category: 'first_order' | 'brand_exclusive' | 'late_night' | 'bestseller' | 'general';
  minOrder?: number;
  maxDiscount?: number;
}

export interface CartItem {
  foodItem: FoodItem;
  quantity: number;
  selectedPortion?: { name: string; price: number };
  selectedAddons?: { id: string; name: string; price: number }[];
  instructions?: string;
  totalPrice: number;
}

export interface Order {
  id: string;
  restaurantName: string;
  restaurantImage?: string;
  itemsSummary: string;
  date: string;
  itemCount: number;
  totalPrice: number;
  status: 'Delivered' | 'Cancelled' | 'Preparing' | 'On the way';
  active?: boolean;
  etaMinutes?: number;
  driverName?: string;
  driverRating?: string;
  driverPhone?: string;
}

export interface Address {
  id: string;
  label: 'Home' | 'Work' | 'Other';
  addressLine1: string;
  addressLine2: string;
  city: string;
  zip: string;
  instructions?: string;
  isDefault?: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  memberSince: string;
  avatar: string;
}
