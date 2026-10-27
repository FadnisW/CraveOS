import type { AdminSubRole, UserProfile } from '../types';

/**
 * Single source of truth for what a signed-in account may open.
 *
 * The API is the real enforcement point; this file only decides which
 * navigation entries are shown and which views the client is allowed to mount.
 * Keeping the matrix in one place means a view can never be reachable just
 * because a URL/state string was guessed.
 */
export type ConsoleView =
  | 'home'
  | 'menu'
  | 'checkout'
  | 'orders'
  | 'profile'
  | 'search'
  | 'admin-dashboard'
  | 'admin-platform'
  | 'admin-users'
  | 'admin-orders'
  | 'admin-riders'
  | 'admin-tickets'
  | 'admin-finance'
  | 'admin-promotions'
  | 'admin-audit'
  | 'admin-kds'
  | 'admin-dispatch'
  | 'hub-ops'
  | 'brand-ops'
  | 'rider-console';

export const CONSOLE_VIEWS: ConsoleView[] = [
  'admin-dashboard',
  'admin-platform',
  'admin-users',
  'admin-orders',
  'admin-riders',
  'admin-tickets',
  'admin-finance',
  'admin-promotions',
  'admin-audit',
  'admin-kds',
  'admin-dispatch',
  'hub-ops',
  'brand-ops',
  'rider-console',
];

export function isConsoleView(view: string): boolean {
  return (CONSOLE_VIEWS as string[]).includes(view);
}

export function isAdmin(user: UserProfile | null | undefined): boolean {
  return user?.role === 'ADMIN';
}

export function hasAdminSubRole(
  user: UserProfile | null | undefined,
  ...subRoles: AdminSubRole[]
): boolean {
  if (!isAdmin(user)) return false;
  // A SUPER_ADMIN can do everything, so callers never need to repeat it.
  if (user?.adminSubRole === 'SUPER_ADMIN') return true;
  return !!user?.adminSubRole && subRoles.includes(user.adminSubRole);
}

const ADMIN_VIEWS_BY_SUBROLE: Record<string, ConsoleView[]> = {
  SUPER_ADMIN: [
    'admin-dashboard',
    'admin-platform',
    'admin-users',
    'admin-orders',
    'admin-riders',
    'admin-tickets',
    'admin-finance',
    'admin-promotions',
    'admin-audit',
    'admin-kds',
    'admin-dispatch',
    'hub-ops',
    'brand-ops',
  ],
  OPERATIONS_ADMIN: [
    'admin-dashboard',
    'admin-users',
    'admin-orders',
    'admin-riders',
    'admin-tickets',
    'admin-audit',
    'admin-kds',
    'admin-dispatch',
    'hub-ops',
    'brand-ops',
  ],
  FINANCE_ADMIN: [
    'admin-dashboard',
    'admin-users',
    'admin-orders',
    'admin-finance',
    'admin-audit',
  ],
  SUPPORT_ADMIN: ['admin-dashboard', 'admin-users', 'admin-orders', 'admin-tickets'],
  MARKETING_ADMIN: ['admin-dashboard', 'admin-promotions'],
};

export function canAccessView(
  view: string,
  user: UserProfile | null | undefined,
): boolean {
  // Storefront routes are open to everyone; checkout/orders still require the
  // API's own authentication, and the UI asks for sign-in at that point.
  if (!isConsoleView(view)) return true;

  if (!user) return false;

  if (user.role === 'ADMIN') {
    const allowed = ADMIN_VIEWS_BY_SUBROLE[user.adminSubRole || ''] || [];
    // Legacy admin accounts without a subrole keep the dashboard only.
    return allowed.includes(view as ConsoleView);
  }

  if (user.role === 'HUB_STAFF') {
    return ['hub-ops', 'admin-kds'].includes(view);
  }

  if (user.role === 'HUB_MANAGER') {
    return ['hub-ops', 'admin-kds', 'admin-dispatch'].includes(view);
  }

  if (user.role === 'BRAND_OPS') {
    return view === 'brand-ops';
  }

  if (user.role === 'RIDER') {
    return view === 'rider-console';
  }

  return false;
}

export function defaultViewFor(user: UserProfile | null | undefined): ConsoleView {
  if (!user) return 'home';
  if (user.role === 'ADMIN') return 'admin-dashboard';
  if (user.role === 'HUB_STAFF' || user.role === 'HUB_MANAGER') return 'hub-ops';
  if (user.role === 'BRAND_OPS') return 'brand-ops';
  if (user.role === 'RIDER') return 'rider-console';
  return 'home';
}

export function isStaff(user: UserProfile | null | undefined): boolean {
  return !!user && user.role !== 'CUSTOMER';
}

export interface ConsoleNavItem {
  view: ConsoleView;
  label: string;
  shortLabel: string;
}

const ADMIN_NAV: ConsoleNavItem[] = [
  { view: 'admin-dashboard', label: 'Overview', shortLabel: 'Overview' },
  { view: 'admin-platform', label: 'Platform Setup', shortLabel: 'Platform' },
  { view: 'admin-users', label: 'Users', shortLabel: 'Users' },
  { view: 'admin-orders', label: 'Orders', shortLabel: 'Orders' },
  { view: 'admin-riders', label: 'Rider KYC', shortLabel: 'KYC' },
  { view: 'admin-tickets', label: 'Support Tickets', shortLabel: 'Tickets' },
  { view: 'admin-finance', label: 'Finance', shortLabel: 'Finance' },
  { view: 'admin-promotions', label: 'Promotions', shortLabel: 'Promos' },
  { view: 'admin-audit', label: 'Audit Log', shortLabel: 'Audit' },
  { view: 'admin-kds', label: 'Kitchen KDS', shortLabel: 'KDS' },
  { view: 'admin-dispatch', label: 'Rider Dispatch', shortLabel: 'Dispatch' },
  { view: 'hub-ops', label: 'Hub Console', shortLabel: 'Hub' },
  { view: 'brand-ops', label: 'Brand Console', shortLabel: 'Brand' },
];

const HUB_NAV: ConsoleNavItem[] = [
  { view: 'hub-ops', label: 'Hub Console', shortLabel: 'Hub' },
  { view: 'admin-kds', label: 'Kitchen KDS', shortLabel: 'KDS' },
  { view: 'admin-dispatch', label: 'Rider Dispatch', shortLabel: 'Dispatch' },
];

const BRAND_NAV: ConsoleNavItem[] = [
  { view: 'brand-ops', label: 'Brand Console', shortLabel: 'Brand' },
];

const RIDER_NAV: ConsoleNavItem[] = [
  { view: 'rider-console', label: 'My Deliveries', shortLabel: 'Deliveries' },
];

export function consoleNavFor(user: UserProfile | null | undefined): ConsoleNavItem[] {
  if (!user) return [];
  if (user.role === 'ADMIN') return ADMIN_NAV.filter((item) => canAccessView(item.view, user));
  if (user.role === 'HUB_STAFF' || user.role === 'HUB_MANAGER') {
    return HUB_NAV.filter((item) => canAccessView(item.view, user));
  }
  if (user.role === 'BRAND_OPS') return BRAND_NAV;
  if (user.role === 'RIDER') return RIDER_NAV;
  return [];
}

export function roleLabel(user: UserProfile | null | undefined): string {
  if (!user) return 'Guest';
  if (user.role === 'ADMIN') {
    return user.adminSubRole ? user.adminSubRole.replace(/_/g, ' ') : 'ADMIN';
  }
  return (user.role || 'CUSTOMER').replace(/_/g, ' ');
}
