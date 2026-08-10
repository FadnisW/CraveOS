const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('eatclub_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  requestOtp: (email: string) =>
    apiRequest('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, code: string) =>
    apiRequest('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  // Catalog
  getBrands: () => apiRequest('/catalog/brands'),
  getBrandBySlug: (slug: string) => apiRequest(`/catalog/brands/${slug}`),
  getMenuItems: (brandSlug?: string, category?: string) => {
    const params = new URLSearchParams();
    if (brandSlug) params.append('brand', brandSlug);
    if (category) params.append('category', category);
    return apiRequest(`/catalog/items?${params.toString()}`);
  },
  searchItems: (query: string) => apiRequest(`/catalog/search?q=${encodeURIComponent(query)}`),
  resolveServiceability: (lat: number, lng: number) =>
    apiRequest('/catalog/serviceability/resolve', {
      method: 'POST',
      body: JSON.stringify({ lat, lng }),
    }),

  // Pricing
  calculatePrice: (items: any[], isMember: boolean, couponCode?: string, useWalletBalance?: number) =>
    apiRequest('/pricing/calculate', {
      method: 'POST',
      body: JSON.stringify({ items, isMember, couponCode, useWalletBalance }),
    }),
  getActiveOffers: () => apiRequest('/pricing/offers/active'),

  // Orders
  createOrder: (orderData: any) =>
    apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    }),

  getOrderById: (orderId: string) => apiRequest(`/orders/${orderId}`),
  getUserOrders: (userId: string) => apiRequest(`/orders/user/${userId}`),
  updateBrandOrderStatus: (ticketId: string, status: string) =>
    apiRequest(`/orders/brand-tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Payments & Wallet
  createRazorpayOrder: (amount: number, orderId: string) =>
    apiRequest('/payments/create-razorpay-order', {
      method: 'POST',
      body: JSON.stringify({ amount, orderId }),
    }),

  getWalletBalance: (userId: string) => apiRequest(`/payments/wallet/${userId}`),

  // Logistics
  autoAssignRider: (orderId: string) =>
    apiRequest(`/logistics/auto-assign/${orderId}`, {
      method: 'POST',
    }),

  getActiveTrips: () => apiRequest('/logistics/trips'),
};
