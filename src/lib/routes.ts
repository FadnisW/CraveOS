/**
 * Canonical URL map for the storefront and staff consoles.
 *
 * The storefront used to be a single page that swapped views in local state, so
 * every screen had a fake address (`/`), the back button did nothing, and a
 * refresh lost the customer's place. These routes are the real ones; the old
 * view ids stay here only so existing chrome and components can ask for a
 * destination without each one hard-coding a path.
 */

export const SHOP_ROUTES = {
  home: '/',
  menu: '/menu',
  search: '/search',
  checkout: '/checkout',
  orders: '/orders',
  account: '/account',
  addresses: '/account/addresses',
  support: '/support',
} as const;

export const OPS_ROUTES = {
  'admin-dashboard': '/ops',
  'admin-platform': '/ops/platform',
  'admin-users': '/ops/users',
  'admin-orders': '/ops/orders',
  'admin-riders': '/ops/riders',
  'admin-tickets': '/ops/tickets',
  'admin-finance': '/ops/finance',
  'admin-promotions': '/ops/promotions',
  'admin-audit': '/ops/audit',
  'admin-kds': '/ops/kds',
  'admin-dispatch': '/ops/dispatch',
  'hub-ops': '/ops/hub',
  'brand-ops': '/ops/brand',
  'rider-console': '/ops/rider',
} as const;

const VIEW_TO_ROUTE: Record<string, string> = {
  ...SHOP_ROUTES,
  profile: SHOP_ROUTES.account,
  ...OPS_ROUTES,
};

const ROUTE_TO_VIEW: Record<string, string> = {
  '/': 'home',
  '/menu': 'menu',
  '/search': 'search',
  '/checkout': 'checkout',
  '/orders': 'orders',
  '/account': 'profile',
  '/account/addresses': 'profile',
  '/support': 'support',
  '/ops': 'admin-dashboard',
  '/ops/platform': 'admin-platform',
  '/ops/users': 'admin-users',
  '/ops/orders': 'admin-orders',
  '/ops/riders': 'admin-riders',
  '/ops/tickets': 'admin-tickets',
  '/ops/finance': 'admin-finance',
  '/ops/promotions': 'admin-promotions',
  '/ops/audit': 'admin-audit',
  '/ops/kds': 'admin-kds',
  '/ops/dispatch': 'admin-dispatch',
  '/ops/hub': 'hub-ops',
  '/ops/brand': 'brand-ops',
  '/ops/rider': 'rider-console',
};

/** Legacy view id → real URL. Unknown ids fall back to the storefront. */
export function routeForView(view: string): string {
  return VIEW_TO_ROUTE[view] || SHOP_ROUTES.home;
}

/** Pathname → legacy view id, used only for active navigation styling. */
export function viewForPathname(pathname: string): string {
  if (ROUTE_TO_VIEW[pathname]) return ROUTE_TO_VIEW[pathname];

  if (pathname.startsWith('/restaurants/')) return 'menu';
  if (pathname.startsWith('/account')) return 'profile';
  if (pathname.startsWith('/support')) return 'support';
  if (pathname.startsWith('/orders')) return 'orders';
  if (pathname.startsWith('/ops')) return 'admin-dashboard';

  return 'home';
}

export const OPS_SEGMENTS: Record<string, string> = {
  platform: 'admin-platform',
  users: 'admin-users',
  orders: 'admin-orders',
  riders: 'admin-riders',
  tickets: 'admin-tickets',
  finance: 'admin-finance',
  promotions: 'admin-promotions',
  audit: 'admin-audit',
  kds: 'admin-kds',
  dispatch: 'admin-dispatch',
  hub: 'hub-ops',
  brand: 'brand-ops',
  rider: 'rider-console',
};

/** `/ops` → dashboard; `/ops/kds` → `admin-kds`; unknown → null. */
export function opsViewForSegment(segment?: string | null): string | null {
  if (!segment) return 'admin-dashboard';
  return OPS_SEGMENTS[segment] || null;
}

export function opsViewForPathname(pathname: string): string {
  if (pathname === '/ops' || pathname === '/ops/') return 'admin-dashboard';
  const segment = pathname.replace(/^\/ops\/?/, '').split('/')[0];
  return OPS_SEGMENTS[segment] || 'admin-dashboard';
}

export function brandRoute(slug: string): string {
  return `/restaurants/${encodeURIComponent(slug)}`;
}

export function orderRoute(orderId: string): string {
  return `/orders?order=${encodeURIComponent(orderId)}`;
}
