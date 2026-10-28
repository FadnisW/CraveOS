/**
 * Browser transport.
 *
 * Requests go to the same-origin BFF (`/api/bff`), never to the NestJS API.
 * The session lives in an httpOnly cookie that JavaScript cannot read, so
 * there is no token in localStorage and no Authorization header here.
 */
const API_BASE = '/api/bff';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err: any = new Error(errorData.message || `API Request failed with status ${response.status}`);
    err.status = response.status;
    err.errorData = errorData;

    if (
      response.status === 401 &&
      typeof window !== 'undefined'
    ) {
      // Let the session provider clear stale local state without coupling the
      // transport to React.
      window.dispatchEvent(new Event('craveos:session-expired'));
    }

    throw err;
  }

  if (response.status === 204) {
    return undefined as T;
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

  verifyOtp: (
    email: string,
    code: string,
    referralCode?: string,
    acceptedLegal?: boolean,
  ) =>
    apiRequest('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        email,
        code,
        referralCode: referralCode?.trim() || undefined,
        acceptedLegal: acceptedLegal === true,
      }),
    }),

  /** Anonymous-safe hydration: `{ authenticated, role, user }`, never a 401. */
  getSession: () => apiRequest('/auth/session'),

  /** Revokes the token id server-side and clears the httpOnly cookie. */
  logout: () =>
    apiRequest('/auth/logout', {
      method: 'POST',
    }),

  /** 60-second, socket-only ticket. Never accepted on HTTP routes. */
  getWsTicket: () =>
    apiRequest<{ ticket: string; expiresIn: number }>('/auth/ws-ticket', {
      method: 'POST',
    }),

  /** The signed-in account with membership, wallet and addresses. */
  getMe: () => apiRequest('/auth/me'),

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
  /**
   * Server-authoritative cart quote.
   *
   * The client sends menu item ids and quantities. Membership, promotions,
   * fees, GST and the wallet cap are all resolved from the database.
   */
  quoteOrder: (payload: {
    addressId?: string;
    hubId?: string;
    items: { menuItemId: string; quantity: number }[];
    couponCode?: string;
    useWalletBalancePaise?: number;
  }) =>
    apiRequest('/pricing/quote', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getActiveOffers: () => apiRequest('/pricing/offers/active'),

  // Membership
  membership: {
    /** Public: purchasable plans (the free trial is granted at signup). */
    getPlans: () => apiRequest('/membership/plans'),
    getMine: () => apiRequest('/membership/me'),
    purchase: (payload: {
      planId?: string;
      planSlug?: string;
      paymentMethod: 'WALLET' | 'RAZORPAY';
      idempotencyKey?: string;
    }) =>
      apiRequest('/membership/purchase', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    verifyPurchase: (payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) =>
      apiRequest('/membership/purchase/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // Referrals
  getMyReferrals: () => apiRequest('/referrals/me'),

  // Orders
  /**
   * `idempotencyKey` must be stable across retries of the *same* checkout
   * attempt. Checkout generates one per mount so a double tap or a dropped
   * response replays the original order instead of charging twice, while a
   * genuinely separate order (same cart, minutes later) gets a new key.
   */
  createOrder: (orderData: any, idempotencyKey?: string) => {
    const key =
      idempotencyKey ||
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

    return apiRequest('/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(orderData),
    });
  },

  getOrderById: (orderId: string) => apiRequest(`/orders/${orderId}`),
  getUserOrders: (userId: string) => apiRequest(`/orders/user/${userId}`),
  cancelOrder: (orderId: string, reason?: string) =>
    apiRequest(`/orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  updateBrandOrderStatus: (ticketId: string, status: string, rejectReason?: string) =>
    apiRequest(`/orders/brand-tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectReason }),
    }),

  // Payments & Wallet
  createRazorpayOrder: (orderId: string) =>
    apiRequest('/payments/create-razorpay-order', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    }),

  /**
   * Confirms a Razorpay checkout callback. The server verifies the HMAC
   * signature and settles the order; the client must not trust the callback.
   */
  verifyPayment: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    apiRequest('/payments/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getWalletBalance: (userId: string) => apiRequest(`/payments/wallet/${userId}`),

  // Addresses
  addresses: {
    list: () => apiRequest('/addresses'),
    create: (data: any) =>
      apiRequest('/addresses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    /**
     * Idempotent checkout provisioning: creates the address if it does not
     * exist for this buyer and returns the canonical database row.
     */
    ensure: (data: any) =>
      apiRequest('/addresses/ensure', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      apiRequest(`/addresses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      apiRequest(`/addresses/${id}`, {
        method: 'DELETE',
      }),
  },

  // Logistics
  autoAssignRider: (orderId: string) =>
    apiRequest(`/logistics/auto-assign/${orderId}`, {
      method: 'POST',
    }),

  getActiveTrips: () => apiRequest('/logistics/trips'),

  acceptTrip: (tripId: string, riderId: string) =>
    apiRequest(`/logistics/trips/${tripId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ riderId }),
    }),

  arrivedAtHub: (tripId: string, riderId: string, lat: number, lng: number) =>
    apiRequest(`/logistics/trips/${tripId}/arrived-hub`, {
      method: 'POST',
      body: JSON.stringify({ riderId, lat, lng }),
    }),

  confirmPickup: (tripId: string, riderId: string) =>
    apiRequest(`/logistics/trips/${tripId}/pickup`, {
      method: 'POST',
      body: JSON.stringify({ riderId }),
    }),

  arrivedAtCustomer: (tripId: string, riderId: string) =>
    apiRequest(`/logistics/trips/${tripId}/arrived-customer`, {
      method: 'POST',
      body: JSON.stringify({ riderId }),
    }),

  verifyDeliveryOtp: (tripId: string, riderId: string, otp: string, proofPhotoUrl?: string) =>
    apiRequest(`/logistics/trips/${tripId}/deliver`, {
      method: 'POST',
      body: JSON.stringify({ riderId, otp, proofPhotoUrl }),
    }),

  rejectTrip: (tripId: string, riderId: string, reason: string) =>
    apiRequest(`/logistics/trips/${tripId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ riderId, reason }),
    }),

  cancelTrip: (tripId: string, reason: string) =>
    apiRequest(`/logistics/trips/${tripId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getRiderActiveTrip: (riderId: string) =>
    apiRequest(`/logistics/trips/rider/${riderId}/active`),

  getRiderTripHistory: (riderId: string) =>
    apiRequest(`/logistics/trips/rider/${riderId}/history`),

  // Support Tickets
  tickets: {
    create: (data: any) =>
      apiRequest('/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getAll: (filters?: any) => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.priority) params.append('priority', filters.priority);
      return apiRequest(`/tickets?${params.toString()}`);
    },

    getById: (id: string) => apiRequest(`/tickets/${id}`),

    assign: (id: string, staffId: string) =>
      apiRequest(`/tickets/${id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ staffId }),
      }),

    updateStatus: (id: string, status: string) =>
      apiRequest(`/tickets/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    resolve: (id: string, resolutionNote: string) =>
      apiRequest(`/tickets/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolutionNote }),
      }),

    getUserTickets: (userId: string) => apiRequest(`/tickets/user/${userId}`),

    getStats: () => apiRequest('/tickets/stats'),
  },

  // Admin Module
  admin: {
    getDashboardKPIs: () => apiRequest('/admin/dashboard/kpis'),
    getLiveOrdersMap: () => apiRequest('/admin/dashboard/live-orders'),
    getOrderDistribution: () => apiRequest('/admin/dashboard/order-distribution'),
    getRevenueTrend: () => apiRequest('/admin/dashboard/revenue-trend'),
    getUsers: (search?: string) => {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      return apiRequest(`/admin/users${params}`);
    },
    getUserById: (id: string) => apiRequest(`/admin/users/${id}`),
    blockUser: (id: string, blocked: boolean) =>
      apiRequest(`/admin/users/${id}/block`, {
        method: 'PATCH',
        body: JSON.stringify({ blocked }),
      }),
    deleteUser: (id: string) =>
      apiRequest(`/admin/users/${id}`, {
        method: 'DELETE',
      }),
    adjustWallet: (id: string, amountInPaise: number, reason: string) =>
      apiRequest(`/admin/users/${id}/wallet-adjust`, {
        method: 'POST',
        body: JSON.stringify({ amountInPaise, reason }),
      }),
    getOrders: (filters?: any) => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.hubId) params.append('hubId', filters.hubId);
      return apiRequest(`/admin/orders?${params.toString()}`);
    },
    manuallyReassignRider: (orderId: string, riderId: string) =>
      apiRequest(`/admin/orders/${orderId}/reassign-rider`, {
        method: 'POST',
        body: JSON.stringify({ riderId }),
      }),
    createHub: (data: any) =>
      apiRequest('/admin/hubs', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateHub: (id: string, data: any) =>
      apiRequest(`/admin/hubs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    assignStaffToHub: (hubId: string, userId: string, role: string) =>
      apiRequest(`/admin/hubs/${hubId}/assign-staff`, {
        method: 'POST',
        body: JSON.stringify({ userId, role }),
      }),
    createBrand: (data: any) =>
      apiRequest('/admin/brands', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateBrand: (id: string, data: any) =>
      apiRequest(`/admin/brands/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    assignBrandOps: (brandId: string, userId: string) =>
      apiRequest(`/admin/brands/${brandId}/assign-ops`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
    getFinanceTransactions: (limit?: number) =>
      apiRequest(`/admin/finance/transactions${limit ? `?limit=${limit}` : ''}`),
    getRiderPayouts: () => apiRequest('/admin/finance/rider-payouts'),
    processBatchRiderPayouts: (riderIds: string[]) =>
      apiRequest('/admin/finance/rider-payouts/batch', {
        method: 'POST',
        body: JSON.stringify({ riderIds }),
      }),
    getRevenueReport: () => apiRequest('/admin/finance/revenue-report'),
    getStaff: () => apiRequest('/admin/staff'),
    createStaff: (data: any) =>
      apiRequest('/admin/staff', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAuditLogs: (action?: string, limit?: number) => {
      const params = new URLSearchParams();
      if (action) params.append('action', action);
      if (limit) params.append('limit', limit.toString());
      return apiRequest(`/admin/audit-log?${params.toString()}`);
    },
    /** Finance: refund a captured gateway/wallet payment. */
    refundOrder: (orderId: string, amountInPaise?: number, reason?: string) =>
      apiRequest(`/admin/orders/${orderId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amountInPaise, reason }),
      }),
    /** Marketing: promotion approval queue. */
    getPromotions: () => apiRequest('/admin/promotions'),
    setPromotionStatus: (id: string, status: 'APPROVED' | 'REJECTED') =>
      apiRequest(`/admin/promotions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    /** Marketing: create an approved promotion (or a draft/proposal). */
    createPromotion: (data: {
      code: string;
      name: string;
      description?: string;
      type: 'PERCENT' | 'FLAT' | 'FREE_DELIVERY';
      value: number;
      minOrderPaise?: number;
      maxDiscountPaise?: number | null;
      brandId?: string | null;
      hubId?: string | null;
      startsAt: string;
      endsAt: string;
      status?: 'DRAFT' | 'APPROVED' | 'PENDING_APPROVAL';
      totalUsageLimit?: number | null;
      perUserLimit?: number;
      firstOrderOnly?: boolean;
    }) =>
      apiRequest('/admin/promotions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Riders Admin / Self
  riders: {
    /** Public: rider phone OTP sign-in (riders have no email column). */
    requestOtp: (phone: string) =>
      apiRequest('/riders/register', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }),
    verifyOtp: (phone: string, code: string, name?: string, vehicleType?: string) =>
      apiRequest('/riders/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, code, name, vehicleType }),
      }),
    getApprovalQueue: () => apiRequest('/riders/approval-queue'),
    getHubs: () => apiRequest('/riders/hubs'),
    getAll: (filters?: any) => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.hubId) params.append('hubId', filters.hubId);
      if (filters?.isOnline !== undefined) params.append('isOnline', filters.isOnline);
      return apiRequest(`/riders?${params.toString()}`);
    },
    getById: (id: string) => apiRequest(`/riders/${id}`),
    updateStatus: (id: string, status: string, reason?: string) =>
      apiRequest(`/riders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      }),
    toggleOnline: (id: string, isOnline: boolean) =>
      apiRequest(`/riders/${id}/online`, {
        method: 'PATCH',
        body: JSON.stringify({ isOnline }),
      }),
    getEarnings: (id: string) => apiRequest(`/riders/${id}/earnings`),
    updateDocuments: (
      id: string,
      docs: {
        vehicleType?: string;
        vehicleRegNo?: string;
        licenceDocUrl?: string;
        vehicleRcDocUrl?: string;
      },
    ) =>
      apiRequest(`/riders/${id}/documents`, {
        method: 'PATCH',
        body: JSON.stringify(docs),
      }),
    updateBank: (id: string, bank: { bankAccountRef?: string; upiId?: string }) =>
      apiRequest(`/riders/${id}/bank`, {
        method: 'PATCH',
        body: JSON.stringify(bank),
      }),
    setHub: (id: string, hubId: string) =>
      apiRequest(`/riders/${id}/hub`, {
        method: 'PATCH',
        body: JSON.stringify({ hubId }),
      }),
    /** Self: GPS ping while on an active trip. */
    pingLocation: (id: string, lat: number, lng: number) =>
      apiRequest(`/logistics/rider/${id}/location`, {
        method: 'POST',
        body: JSON.stringify({ lat, lng }),
      }),
  },

  // Hub Operations (§5.1)
  hubOps: {
    getHubs: () => apiRequest('/hub-ops/hubs'),
    getDashboard: (hubId: string) => apiRequest(`/hub-ops/${hubId}/dashboard`),
    getStock: (hubId: string) => apiRequest(`/hub-ops/${hubId}/stock`),
    bulkToggle86: (hubId: string, updates: { menuItemId: string; isAvailable: boolean }[]) =>
      apiRequest(`/hub-ops/${hubId}/stock/bulk-86`, {
        method: 'PATCH',
        body: JSON.stringify({ updates }),
      }),
    getStaff: (hubId: string) => apiRequest(`/hub-ops/${hubId}/staff`),
    assignStaff: (hubId: string, userId: string, role: 'HUB_STAFF' | 'HUB_MANAGER') =>
      apiRequest(`/hub-ops/${hubId}/staff/assign`, {
        method: 'POST',
        body: JSON.stringify({ userId, role }),
      }),
    getFinance: (hubId: string) => apiRequest(`/hub-ops/${hubId}/finance`),
    getRiders: (hubId: string) => apiRequest(`/hub-ops/${hubId}/riders`),
    getKdsTickets: (hubId: string) => apiRequest(`/hub-ops/${hubId}/kds/tickets`),
    confirmRiderHandoff: (hubId: string, tripId: string) =>
      apiRequest(`/hub-ops/${hubId}/rider-handoff/${tripId}`, {
        method: 'POST',
      }),
  },

  // Brand Operations (§5.2)
  brandOps: {
    getDashboard: (brandId: string) => apiRequest(`/brand-ops/${brandId}/dashboard`),
    getMenu: (brandId: string) => apiRequest(`/brand-ops/${brandId}/menu`),
    createMenuItem: (brandId: string, data: any) =>
      apiRequest(`/brand-ops/${brandId}/menu/items`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateMenuItem: (brandId: string, itemId: string, data: any) =>
      apiRequest(`/brand-ops/${brandId}/menu/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteMenuItem: (brandId: string, itemId: string) =>
      apiRequest(`/brand-ops/${brandId}/menu/items/${itemId}`, {
        method: 'DELETE',
      }),
    bulkUpdatePrice: (brandId: string, updates: { itemId: string; mrpInPaise: number; memberPriceInPaise?: number }[]) =>
      apiRequest(`/brand-ops/${brandId}/menu/items/bulk-price`, {
        method: 'PATCH',
        body: JSON.stringify({ updates }),
      }),
    proposePromotion: (brandId: string, data: any) =>
      apiRequest(`/brand-ops/${brandId}/promotions/propose`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAnalytics: (brandId: string) => apiRequest(`/brand-ops/${brandId}/analytics`),
    getFinance: (brandId: string) => apiRequest(`/brand-ops/${brandId}/finance`),
  },
};


