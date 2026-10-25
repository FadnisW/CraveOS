'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api-client';
import { useUser } from '../context/UserContext';
import { hasAdminSubRole } from '../lib/roles';
import {
  AlertCircle,
  BadgeIndianRupee,
  Building2,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Store,
  Tag,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';

type PlatformTab = 'staff' | 'hubs' | 'brands' | 'finance' | 'promotions' | 'audit';

interface TabDef {
  id: PlatformTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { id: 'staff', label: 'Staff & Roles', icon: <Users className="w-4 h-4" /> },
  { id: 'hubs', label: 'Hubs', icon: <Building2 className="w-4 h-4" /> },
  { id: 'brands', label: 'Brands', icon: <Store className="w-4 h-4" /> },
  { id: 'finance', label: 'Finance', icon: <BadgeIndianRupee className="w-4 h-4" /> },
  { id: 'promotions', label: 'Promotions', icon: <Megaphone className="w-4 h-4" /> },
  { id: 'audit', label: 'Audit Log', icon: <ScrollText className="w-4 h-4" /> },
];

const ADMIN_SUB_ROLES = [
  'SUPER_ADMIN',
  'OPERATIONS_ADMIN',
  'FINANCE_ADMIN',
  'SUPPORT_ADMIN',
  'MARKETING_ADMIN',
] as const;

const STAFF_ROLES = ['ADMIN', 'HUB_MANAGER', 'HUB_STAFF', 'BRAND_OPS'] as const;

function rupees(paise: number | undefined | null) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

function toPaise(value: string): number | undefined {
  const trimmed = String(value || '').trim();
  if (!trimmed) return undefined;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return Math.round(amount * 100);
}

function errorText(err: any, fallback: string) {
  return err?.message || fallback;
}

export const AdminPlatformView: React.FC<{ initialTab?: PlatformTab }> = ({
  initialTab = 'staff',
}) => {
  const { user } = useUser();

  const allowedTabs = useMemo(() => {
    const allowed: TabDef[] = [];
    if (hasAdminSubRole(user, 'SUPER_ADMIN')) {
      allowed.push(TABS[0], TABS[1], TABS[2]);
    } else if (hasAdminSubRole(user, 'OPERATIONS_ADMIN')) {
      allowed.push(TABS[1]);
    }
    if (hasAdminSubRole(user, 'FINANCE_ADMIN')) allowed.push(TABS[3]);
    if (hasAdminSubRole(user, 'MARKETING_ADMIN')) allowed.push(TABS[4]);
    if (hasAdminSubRole(user, 'OPERATIONS_ADMIN', 'FINANCE_ADMIN')) allowed.push(TABS[5]);

    // Preserve the declared order and drop duplicates.
    return TABS.filter((tab) => allowed.some((candidate) => candidate.id === tab.id));
  }, [user]);

  const [tab, setTab] = useState<PlatformTab>(initialTab);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [staff, setStaff] = useState<any[]>([]);
  const [hubs, setHubs] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any>(null);
  const [transactions, setTransactions] = useState<{ payments: any[]; walletTxns: any[] }>({
    payments: [],
    walletTxns: [],
  });
  const [payouts, setPayouts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [staffDraft, setStaffDraft] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'ADMIN' as (typeof STAFF_ROLES)[number],
    adminSubRole: 'OPERATIONS_ADMIN' as (typeof ADMIN_SUB_ROLES)[number],
    scopedHubId: '',
    scopedBrandId: '',
  });

  const [hubDraft, setHubDraft] = useState({
    name: '',
    city: 'Bengaluru',
    lat: '12.9121',
    lng: '77.6445',
    operatingHoursStart: '08:00',
    operatingHoursEnd: '03:00',
    polygon: '',
  });
  const [editingHubId, setEditingHubId] = useState<string>('');
  const [hubEditDraft, setHubEditDraft] = useState({
    name: '',
    city: '',
    operatingHoursStart: '',
    operatingHoursEnd: '',
  });
  const [hubStaffDraft, setHubStaffDraft] = useState({
    hubId: '',
    userId: '',
    role: 'HUB_STAFF' as 'HUB_STAFF' | 'HUB_MANAGER',
  });

  const [brandDraft, setBrandDraft] = useState({
    name: '',
    slug: '',
    tagline: '',
    cuisine: '',
    logoUrl:
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80',
    heroImageUrl:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80',
    themeColor: '#E11D48',
    minOrderRupees: '149',
  });
  const [editingBrandId, setEditingBrandId] = useState<string>('');
  const [brandEditDraft, setBrandEditDraft] = useState({
    name: '',
    tagline: '',
    minOrderRupees: '',
    isActive: true,
  });
  const [brandOpsDraft, setBrandOpsDraft] = useState({ brandId: '', userId: '' });

  const [refundDraft, setRefundDraft] = useState({
    orderId: '',
    amountRupees: '',
    reason: '',
  });
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([]);

  const visibleTab = allowedTabs.some((candidate) => candidate.id === tab)
    ? tab
    : allowedTabs[0]?.id || 'staff';

  useEffect(() => {
    if (allowedTabs.length === 0) return;
    if (!allowedTabs.some((candidate) => candidate.id === tab)) {
      setTab(allowedTabs[0].id);
    }
  }, [allowedTabs, tab]);

  const loadTab = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (visibleTab === 'staff') {
        const [staffRows, hubRows, brandRows] = await Promise.all([
          api.admin.getStaff(),
          api.hubOps.getHubs(),
          api.getBrands(),
        ]);
        setStaff(Array.isArray(staffRows) ? staffRows : []);
        setHubs(Array.isArray(hubRows) ? hubRows : []);
        setBrands(Array.isArray(brandRows) ? brandRows : []);
      } else if (visibleTab === 'hubs') {
        const [hubRows, staffRows] = await Promise.all([
          api.hubOps.getHubs(),
          api.admin.getStaff().catch(() => []),
        ]);
        setHubs(Array.isArray(hubRows) ? hubRows : []);
        setStaff(Array.isArray(staffRows) ? staffRows : []);
      } else if (visibleTab === 'brands') {
        const [brandRows, staffRows] = await Promise.all([
          api.getBrands(),
          api.admin.getStaff().catch(() => []),
        ]);
        setBrands(Array.isArray(brandRows) ? brandRows : []);
        setStaff(Array.isArray(staffRows) ? staffRows : []);
      } else if (visibleTab === 'finance') {
        const [report, txn, payoutRows] = await Promise.all([
          api.admin.getRevenueReport(),
          api.admin.getFinanceTransactions(50),
          api.admin.getRiderPayouts(),
        ]);
        setRevenue(report || null);
        setTransactions({
          payments: Array.isArray(txn?.payments) ? txn.payments : [],
          walletTxns: Array.isArray(txn?.walletTxns) ? txn.walletTxns : [],
        });
        setPayouts(Array.isArray(payoutRows) ? payoutRows : []);
      } else if (visibleTab === 'promotions') {
        const rows = await api.admin.getPromotions();
        setPromotions(Array.isArray(rows) ? rows : []);
      } else if (visibleTab === 'audit') {
        const rows = await api.admin.getAuditLogs(undefined, 100);
        setAuditLogs(Array.isArray(rows) ? rows : []);
      }
    } catch (err: any) {
      setError(errorText(err, `Failed to load ${visibleTab}.`));
    } finally {
      setLoading(false);
    }
  }, [visibleTab]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  const run = async (action: () => Promise<any>, success: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await loadTab();
      setTimeout(() => setMessage(null), 4500);
    } catch (err: any) {
      setError(errorText(err, 'The action could not be completed.'));
    } finally {
      setBusy(false);
    }
  };

  const createStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload: any = {
      name: staffDraft.name.trim(),
      email: staffDraft.email.trim(),
      phone: staffDraft.phone.trim(),
      role: staffDraft.role,
    };
    if (staffDraft.role === 'ADMIN') payload.adminSubRole = staffDraft.adminSubRole;
    if (staffDraft.role === 'HUB_STAFF' || staffDraft.role === 'HUB_MANAGER') {
      payload.scopedHubId = staffDraft.scopedHubId;
    }
    if (staffDraft.role === 'BRAND_OPS') payload.scopedBrandId = staffDraft.scopedBrandId;

    await run(
      () => api.admin.createStaff(payload),
      `${payload.name} can now sign in with ${payload.email}.`,
    );
    setStaffDraft((current) => ({ ...current, name: '', email: '', phone: '' }));
  };

  const createHub = async (event: React.FormEvent) => {
    event.preventDefault();
    const lat = Number(hubDraft.lat);
    const lng = Number(hubDraft.lng);
    let servicePolygon: any;

    if (hubDraft.polygon.trim()) {
      try {
        servicePolygon = JSON.parse(hubDraft.polygon);
      } catch {
        setError('The service polygon is not valid JSON.');
        return;
      }
    } else {
      // A small square around the hub keeps a new hub serviceable until ops
      // draws the real polygon.
      servicePolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [lng - 0.03, lat - 0.03],
            [lng + 0.03, lat - 0.03],
            [lng + 0.03, lat + 0.03],
            [lng - 0.03, lat + 0.03],
            [lng - 0.03, lat - 0.03],
          ],
        ],
      };
    }

    await run(
      () =>
        api.admin.createHub({
          name: hubDraft.name.trim(),
          city: hubDraft.city.trim(),
          lat,
          lng,
          servicePolygon,
          operatingHoursStart: hubDraft.operatingHoursStart,
          operatingHoursEnd: hubDraft.operatingHoursEnd,
        }),
      `Hub ${hubDraft.name.trim()} created.`,
    );
    setHubDraft((current) => ({ ...current, name: '', polygon: '' }));
  };

  const saveHub = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingHubId) return;
    await run(
      () =>
        api.admin.updateHub(editingHubId, {
          name: hubEditDraft.name.trim() || undefined,
          city: hubEditDraft.city.trim() || undefined,
          operatingHoursStart: hubEditDraft.operatingHoursStart || undefined,
          operatingHoursEnd: hubEditDraft.operatingHoursEnd || undefined,
        }),
      'Hub updated.',
    );
    setEditingHubId('');
  };

  const assignHubStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(
      () =>
        api.admin.assignStaffToHub(
          hubStaffDraft.hubId,
          hubStaffDraft.userId.trim(),
          hubStaffDraft.role,
        ),
      `User assigned to the hub as ${hubStaffDraft.role.replace('_', ' ')}.`,
    );
    setHubStaffDraft((current) => ({ ...current, userId: '' }));
  };

  const createBrand = async (event: React.FormEvent) => {
    event.preventDefault();
    const minOrderPaise = toPaise(brandDraft.minOrderRupees);
    await run(
      () =>
        api.admin.createBrand({
          name: brandDraft.name.trim(),
          slug: brandDraft.slug.trim().toLowerCase(),
          tagline: brandDraft.tagline.trim(),
          cuisine: brandDraft.cuisine
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean),
          logoUrl: brandDraft.logoUrl.trim(),
          heroImageUrl: brandDraft.heroImageUrl.trim(),
          themeColor: brandDraft.themeColor.trim() || '#E11D48',
          minOrderValue: minOrderPaise,
        }),
      `Brand ${brandDraft.name.trim()} created.`,
    );
    setBrandDraft((current) => ({ ...current, name: '', slug: '', tagline: '', cuisine: '' }));
  };

  const saveBrand = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingBrandId) return;
    await run(
      () =>
        api.admin.updateBrand(editingBrandId, {
          name: brandEditDraft.name.trim() || undefined,
          tagline: brandEditDraft.tagline.trim() || undefined,
          minOrderValue: toPaise(brandEditDraft.minOrderRupees),
          isActive: brandEditDraft.isActive,
        }),
      'Brand updated.',
    );
    setEditingBrandId('');
  };

  const assignBrandOps = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(
      () => api.admin.assignBrandOps(brandOpsDraft.brandId, brandOpsDraft.userId.trim()),
      'Brand ops manager assigned.',
    );
    setBrandOpsDraft((current) => ({ ...current, userId: '' }));
  };

  const refundOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!refundDraft.orderId.trim()) return;
    const amountPaise = toPaise(refundDraft.amountRupees);
    await run(
      () =>
        api.admin.refundOrder(
          refundDraft.orderId.trim(),
          amountPaise,
          refundDraft.reason.trim() || undefined,
        ),
      amountPaise
        ? `${rupees(amountPaise)} refunded for order ${refundDraft.orderId.slice(0, 8)}.`
        : `Order ${refundDraft.orderId.slice(0, 8)} refunded in full.`,
    );
    setRefundDraft({ orderId: '', amountRupees: '', reason: '' });
  };

  const processPayouts = async () => {
    if (selectedPayouts.length === 0) {
      setError('Select at least one rider with an outstanding balance.');
      return;
    }
    await run(
      () => api.admin.processBatchRiderPayouts(selectedPayouts),
      `Payout batch processed for ${selectedPayouts.length} rider(s).`,
    );
    setSelectedPayouts([]);
  };

  const setPromotionStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await run(
      () => api.admin.setPromotionStatus(id, status),
      `Promotion ${status === 'APPROVED' ? 'approved' : 'rejected'}.`,
    );
  };

  const pendingPromotions = promotions.filter(
    (promotion) => promotion.status === 'PENDING_ADMIN_APPROVAL',
  );
  const reviewedPromotions = promotions.filter(
    (promotion) => promotion.status !== 'PENDING_ADMIN_APPROVAL',
  );

  if (allowedTabs.length === 0) {
    return (
      <div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-center text-sm text-gray-500">
        This account has no platform setup permissions.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">Platform Administration</h1>
            <p className="text-xs text-slate-400">
              Staff, hubs, brands, money, promotions and the audit trail
            </p>
          </div>
        </div>
        <button
          onClick={loadTab}
          disabled={loading}
          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {allowedTabs.map((candidate) => (
          <button
            key={candidate.id}
            onClick={() => setTab(candidate.id)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
              visibleTab === candidate.id
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
            }`}
          >
            {candidate.icon}
            {candidate.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-400">Loading {visibleTab}…</div>
      ) : (
        <>
          {visibleTab === 'staff' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 text-sm font-extrabold text-gray-900 dark:text-white">
                  Staff accounts ({staff.length})
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[620px] overflow-y-auto">
                  {staff.map((member) => {
                    const hub = hubs.find((row) => row.id === member.scopedHubId);
                    const brand = brands.find((row) => row.id === member.scopedBrandId);
                    return (
                      <div key={member.id} className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-gray-900 dark:text-white truncate">
                            {member.name || member.email}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">
                            {member.email} • {member.phone || 'no phone'}
                          </div>
                          {(hub || brand) && (
                            <div className="text-[10px] text-indigo-500 font-bold">
                              {hub ? `Hub: ${hub.name}` : `Brand: ${brand?.name || member.scopedBrandId}`}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-gray-600 dark:text-slate-300">
                          {member.role === 'ADMIN'
                            ? member.adminSubRole || 'ADMIN'
                            : member.role.replace('_', ' ')}
                        </span>
                      </div>
                    );
                  })}
                  {staff.length === 0 && (
                    <div className="p-10 text-center text-xs text-gray-400">
                      No staff accounts yet.
                    </div>
                  )}
                </div>
              </div>

              <form
                onSubmit={createStaff}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5 space-y-3 h-fit"
              >
                <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-rose-500" />
                  Create staff account
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  Staff sign in with an email OTP. No password is created.
                </p>

                <Field label="Full name">
                  <input
                    required
                    value={staffDraft.name}
                    onChange={(event) =>
                      setStaffDraft({ ...staffDraft, name: event.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Email">
                  <input
                    required
                    type="email"
                    value={staffDraft.email}
                    onChange={(event) =>
                      setStaffDraft({ ...staffDraft, email: event.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    required
                    value={staffDraft.phone}
                    onChange={(event) =>
                      setStaffDraft({ ...staffDraft, phone: event.target.value })
                    }
                    placeholder="+919900011199"
                    className={inputClass}
                  />
                </Field>

                <Field label="Role">
                  <select
                    value={staffDraft.role}
                    onChange={(event) =>
                      setStaffDraft({
                        ...staffDraft,
                        role: event.target.value as (typeof STAFF_ROLES)[number],
                      })
                    }
                    className={inputClass}
                  >
                    {STAFF_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </Field>

                {staffDraft.role === 'ADMIN' && (
                  <Field label="Admin sub-role">
                    <select
                      value={staffDraft.adminSubRole}
                      onChange={(event) =>
                        setStaffDraft({
                          ...staffDraft,
                          adminSubRole: event.target.value as (typeof ADMIN_SUB_ROLES)[number],
                        })
                      }
                      className={inputClass}
                    >
                      {ADMIN_SUB_ROLES.map((subRole) => (
                        <option key={subRole} value={subRole}>
                          {subRole.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                {(staffDraft.role === 'HUB_STAFF' || staffDraft.role === 'HUB_MANAGER') && (
                  <Field label="Scoped hub">
                    <select
                      required
                      value={staffDraft.scopedHubId}
                      onChange={(event) =>
                        setStaffDraft({ ...staffDraft, scopedHubId: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Select hub…</option>
                      {hubs.map((hub) => (
                        <option key={hub.id} value={hub.id}>
                          {hub.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                {staffDraft.role === 'BRAND_OPS' && (
                  <Field label="Scoped brand">
                    <select
                      required
                      value={staffDraft.scopedBrandId}
                      onChange={(event) =>
                        setStaffDraft({ ...staffDraft, scopedBrandId: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Select brand…</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {busy ? 'Creating…' : 'Create account'}
                </button>
              </form>
            </div>
          )}

          {visibleTab === 'hubs' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-slate-800 text-sm font-extrabold text-gray-900 dark:text-white">
                    Hubs ({hubs.length})
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {hubs.map((hub) => (
                      <div key={hub.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-extrabold text-gray-900 dark:text-white">
                              {hub.name}
                            </div>
                            <div className="text-[10px] text-gray-400">{hub.city}</div>
                          </div>
                          <button
                            onClick={() => {
                              setEditingHubId(hub.id);
                              setHubEditDraft({
                                name: hub.name || '',
                                city: hub.city || '',
                                operatingHoursStart: '',
                                operatingHoursEnd: '',
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-gray-600 dark:text-slate-300"
                          >
                            Edit
                          </button>
                        </div>

                        {editingHubId === hub.id && (
                          <form onSubmit={saveHub} className="grid grid-cols-2 gap-2 pt-1">
                            <input
                              value={hubEditDraft.name}
                              onChange={(event) =>
                                setHubEditDraft({ ...hubEditDraft, name: event.target.value })
                              }
                              placeholder="Hub name"
                              className={inputClass}
                            />
                            <input
                              value={hubEditDraft.city}
                              onChange={(event) =>
                                setHubEditDraft({ ...hubEditDraft, city: event.target.value })
                              }
                              placeholder="City"
                              className={inputClass}
                            />
                            <input
                              value={hubEditDraft.operatingHoursStart}
                              onChange={(event) =>
                                setHubEditDraft({
                                  ...hubEditDraft,
                                  operatingHoursStart: event.target.value,
                                })
                              }
                              placeholder="Open (08:00)"
                              className={inputClass}
                            />
                            <input
                              value={hubEditDraft.operatingHoursEnd}
                              onChange={(event) =>
                                setHubEditDraft({
                                  ...hubEditDraft,
                                  operatingHoursEnd: event.target.value,
                                })
                              }
                              placeholder="Close (03:00)"
                              className={inputClass}
                            />
                            <div className="col-span-2 flex items-center gap-2">
                              <button
                                type="submit"
                                disabled={busy}
                                className="flex-1 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-bold disabled:opacity-50"
                              >
                                Save hub
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingHubId('')}
                                className="px-3 py-2 rounded-xl text-[11px] font-bold text-gray-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ))}
                    {hubs.length === 0 && (
                      <div className="p-10 text-center text-xs text-gray-400">No hubs yet.</div>
                    )}
                  </div>
                </div>

                <form
                  onSubmit={createHub}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5 space-y-3 h-fit"
                >
                  <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-500" />
                    Create hub
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Name">
                      <input
                        required
                        value={hubDraft.name}
                        onChange={(event) =>
                          setHubDraft({ ...hubDraft, name: event.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="City">
                      <input
                        required
                        value={hubDraft.city}
                        onChange={(event) =>
                          setHubDraft({ ...hubDraft, city: event.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Latitude">
                      <input
                        required
                        type="number"
                        step="0.0001"
                        value={hubDraft.lat}
                        onChange={(event) =>
                          setHubDraft({ ...hubDraft, lat: event.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Longitude">
                      <input
                        required
                        type="number"
                        step="0.0001"
                        value={hubDraft.lng}
                        onChange={(event) =>
                          setHubDraft({ ...hubDraft, lng: event.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Opens">
                      <input
                        value={hubDraft.operatingHoursStart}
                        onChange={(event) =>
                          setHubDraft({ ...hubDraft, operatingHoursStart: event.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Closes">
                      <input
                        value={hubDraft.operatingHoursEnd}
                        onChange={(event) =>
                          setHubDraft({ ...hubDraft, operatingHoursEnd: event.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <Field label="Service polygon (optional GeoJSON)">
                    <textarea
                      rows={3}
                      value={hubDraft.polygon}
                      onChange={(event) =>
                        setHubDraft({ ...hubDraft, polygon: event.target.value })
                      }
                      placeholder='Leave blank to auto-generate a 3 km square around the hub.'
                      className={inputClass}
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold disabled:opacity-50"
                  >
                    {busy ? 'Creating…' : 'Create hub'}
                  </button>
                </form>
              </div>

              <form
                onSubmit={assignHubStaff}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5 space-y-3"
              >
                <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  Assign an existing user to a hub
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  This changes the account's role and scoped hub. Admin, rider and brand-ops
                  accounts are rejected by the API.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <select
                    required
                    value={hubStaffDraft.hubId}
                    onChange={(event) =>
                      setHubStaffDraft({ ...hubStaffDraft, hubId: event.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">Select hub…</option>
                    {hubs.map((hub) => (
                      <option key={hub.id} value={hub.id}>
                        {hub.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={hubStaffDraft.role}
                    onChange={(event) =>
                      setHubStaffDraft({
                        ...hubStaffDraft,
                        role: event.target.value as 'HUB_STAFF' | 'HUB_MANAGER',
                      })
                    }
                    className={inputClass}
                  >
                    <option value="HUB_STAFF">Hub Staff</option>
                    <option value="HUB_MANAGER">Hub Manager</option>
                  </select>
                  <input
                    required
                    value={hubStaffDraft.userId}
                    onChange={(event) =>
                      setHubStaffDraft({ ...hubStaffDraft, userId: event.target.value })
                    }
                    placeholder="User id"
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>

                {staff.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {staff
                      .filter((member) => member.role !== 'ADMIN')
                      .slice(0, 12)
                      .map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() =>
                            setHubStaffDraft({ ...hubStaffDraft, userId: member.id })
                          }
                          className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-[10px] font-bold text-gray-600 dark:text-slate-300"
                          title={member.id}
                        >
                          {member.name || member.email} ({member.role.replace('_', ' ')})
                        </button>
                      ))}
                  </div>
                )}
              </form>
            </div>
          )}

          {visibleTab === 'brands' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-slate-800 text-sm font-extrabold text-gray-900 dark:text-white">
                    Brands ({brands.length})
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[620px] overflow-y-auto">
                    {brands.map((brand) => (
                      <div key={brand.id} className="p-4 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0">
                            {brand.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={brand.logoUrl}
                                alt={brand.name}
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-extrabold text-gray-900 dark:text-white truncate">
                              {brand.name}
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">
                              {brand.slug} • min {rupees(brand.minOrderValue)} •{' '}
                              {brand.isActive ? 'active' : 'inactive'}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setEditingBrandId(brand.id);
                              setBrandEditDraft({
                                name: brand.name || '',
                                tagline: brand.tagline || '',
                                minOrderRupees: String(
                                  Math.round((Number(brand.minOrderValue) || 0) / 100),
                                ),
                                isActive: brand.isActive !== false,
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-gray-600 dark:text-slate-300"
                          >
                            Edit
                          </button>
                        </div>

                        {editingBrandId === brand.id && (
                          <form onSubmit={saveBrand} className="grid grid-cols-2 gap-2 pt-1">
                            <input
                              value={brandEditDraft.name}
                              onChange={(event) =>
                                setBrandEditDraft({ ...brandEditDraft, name: event.target.value })
                              }
                              placeholder="Brand name"
                              className={inputClass}
                            />
                            <input
                              value={brandEditDraft.tagline}
                              onChange={(event) =>
                                setBrandEditDraft({
                                  ...brandEditDraft,
                                  tagline: event.target.value,
                                })
                              }
                              placeholder="Tagline"
                              className={inputClass}
                            />
                            <input
                              value={brandEditDraft.minOrderRupees}
                              onChange={(event) =>
                                setBrandEditDraft({
                                  ...brandEditDraft,
                                  minOrderRupees: event.target.value,
                                })
                              }
                              placeholder="Min order ₹"
                              className={inputClass}
                            />
                            <label className="flex items-center gap-2 px-2 text-[11px] font-bold text-gray-600 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={brandEditDraft.isActive}
                                onChange={(event) =>
                                  setBrandEditDraft({
                                    ...brandEditDraft,
                                    isActive: event.target.checked,
                                  })
                                }
                              />
                              Active
                            </label>
                            <div className="col-span-2 flex items-center gap-2">
                              <button
                                type="submit"
                                disabled={busy}
                                className="flex-1 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-bold disabled:opacity-50"
                              >
                                Save brand
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingBrandId('')}
                                className="px-3 py-2 rounded-xl text-[11px] font-bold text-gray-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <form
                  onSubmit={createBrand}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5 space-y-3 h-fit"
                >
                  <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <Tag className="w-4 h-4 text-rose-500" />
                    Create brand
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Name">
                      <input
                        required
                        value={brandDraft.name}
                        onChange={(event) =>
                          setBrandDraft({ ...brandDraft, name: event.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Slug">
                      <input
                        required
                        value={brandDraft.slug}
                        onChange={(event) =>
                          setBrandDraft({ ...brandDraft, slug: event.target.value })
                        }
                        placeholder="new-brand"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <Field label="Tagline">
                    <input
                      value={brandDraft.tagline}
                      onChange={(event) =>
                        setBrandDraft({ ...brandDraft, tagline: event.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Cuisine (comma separated)">
                    <input
                      value={brandDraft.cuisine}
                      onChange={(event) =>
                        setBrandDraft({ ...brandDraft, cuisine: event.target.value })
                      }
                      placeholder="Pizza, Italian"
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Theme colour">
                      <input
                        value={brandDraft.themeColor}
                        onChange={(event) =>
                          setBrandDraft({ ...brandDraft, themeColor: event.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Min order ₹">
                      <input
                        value={brandDraft.minOrderRupees}
                        onChange={(event) =>
                          setBrandDraft({ ...brandDraft, minOrderRupees: event.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <Field label="Logo URL">
                    <input
                      required
                      value={brandDraft.logoUrl}
                      onChange={(event) =>
                        setBrandDraft({ ...brandDraft, logoUrl: event.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Hero image URL">
                    <input
                      required
                      value={brandDraft.heroImageUrl}
                      onChange={(event) =>
                        setBrandDraft({ ...brandDraft, heroImageUrl: event.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold disabled:opacity-50"
                  >
                    {busy ? 'Creating…' : 'Create brand'}
                  </button>
                </form>
              </div>

              <form
                onSubmit={assignBrandOps}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5 space-y-3"
              >
                <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  Assign a brand ops manager
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    required
                    value={brandOpsDraft.brandId}
                    onChange={(event) =>
                      setBrandOpsDraft({ ...brandOpsDraft, brandId: event.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">Select brand…</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    value={brandOpsDraft.userId}
                    onChange={(event) =>
                      setBrandOpsDraft({ ...brandOpsDraft, userId: event.target.value })
                    }
                    placeholder="User id"
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
                {staff.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {staff
                      .filter((member) => member.role !== 'ADMIN')
                      .slice(0, 12)
                      .map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() =>
                            setBrandOpsDraft({ ...brandOpsDraft, userId: member.id })
                          }
                          className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-[10px] font-bold text-gray-600 dark:text-slate-300"
                          title={member.id}
                        >
                          {member.name || member.email} ({member.role.replace('_', ' ')})
                        </button>
                      ))}
                  </div>
                )}
              </form>
            </div>
          )}

          {visibleTab === 'finance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Metric label="Net collected" value={rupees(revenue?.totalRevenuePaise)} />
                <Metric label="Paid transactions" value={revenue?.totalTransactions ?? 0} />
                <Metric label="Razorpay" value={rupees(revenue?.byGateway?.RAZORPAY)} />
                <Metric
                  label="Wallet / COD"
                  value={`${rupees(revenue?.byGateway?.WALLET)} / ${rupees(
                    revenue?.byGateway?.COD,
                  )}`}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form
                  onSubmit={refundOrder}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5 space-y-3"
                >
                  <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-500" />
                    Refund an order
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Refunds go back to the gateway or wallet that paid. Leave the amount blank
                    for a full refund.
                  </p>
                  <Field label="Order id">
                    <input
                      required
                      value={refundDraft.orderId}
                      onChange={(event) =>
                        setRefundDraft({ ...refundDraft, orderId: event.target.value })
                      }
                      placeholder="Order cuid"
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Amount ₹ (optional)">
                      <input
                        value={refundDraft.amountRupees}
                        onChange={(event) =>
                          setRefundDraft({ ...refundDraft, amountRupees: event.target.value })
                        }
                        placeholder="Full"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Reason">
                      <input
                        value={refundDraft.reason}
                        onChange={(event) =>
                          setRefundDraft({ ...refundDraft, reason: event.target.value })
                        }
                        placeholder="Customer complaint"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold disabled:opacity-50"
                  >
                    {busy ? 'Refunding…' : 'Refund order'}
                  </button>
                </form>

                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">
                      Rider payouts
                    </h2>
                    <button
                      onClick={processPayouts}
                      disabled={busy || selectedPayouts.length === 0}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-50"
                    >
                      Pay selected ({selectedPayouts.length})
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                    {payouts.map((payout) => {
                      const due = Number(payout.totalEarnedPaise) || 0;
                      return (
                        <label
                          key={payout.riderId}
                          className="p-3 flex items-center gap-3 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            disabled={due <= 0}
                            checked={selectedPayouts.includes(payout.riderId)}
                            onChange={(event) =>
                              setSelectedPayouts((current) =>
                                event.target.checked
                                  ? [...current, payout.riderId]
                                  : current.filter((id) => id !== payout.riderId),
                              )
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-gray-900 dark:text-white truncate">
                              {payout.name || payout.phone}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {payout.upiId || payout.bankAccountRef || 'No payout method'}
                            </div>
                          </div>
                          <span
                            className={`font-black ${
                              due > 0 ? 'text-emerald-600' : 'text-gray-400'
                            }`}
                          >
                            {rupees(due)}
                          </span>
                        </label>
                      );
                    })}
                    {payouts.length === 0 && (
                      <div className="p-8 text-center text-xs text-gray-400">
                        No approved riders.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 text-sm font-extrabold text-gray-900 dark:text-white">
                  Recent payments
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-slate-800/60 text-[10px] uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-4 py-2">Order</th>
                        <th className="px-4 py-2">Gateway</th>
                        <th className="px-4 py-2">Amount</th>
                        <th className="px-4 py-2">Refunded</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {transactions.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-4 py-2 font-mono text-[10px]">
                            {String(payment.orderId || '').slice(0, 8)}
                          </td>
                          <td className="px-4 py-2">{payment.gateway}</td>
                          <td className="px-4 py-2 font-bold">
                            {rupees(payment.amountInPaise)}
                          </td>
                          <td className="px-4 py-2 text-rose-500">
                            {rupees(payment.refundedAmountPaise)}
                          </td>
                          <td className="px-4 py-2">{payment.status}</td>
                        </tr>
                      ))}
                      {transactions.payments.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                            No payments yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 text-sm font-extrabold text-gray-900 dark:text-white">
                  Recent wallet ledger
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {transactions.walletTxns.map((txn) => (
                    <div key={txn.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {txn.user?.name || txn.user?.phone || 'Customer'}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {txn.reason} • {new Date(txn.createdAt).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <span
                        className={`font-black ${
                          txn.amountInPaise >= 0 ? 'text-emerald-600' : 'text-rose-500'
                        }`}
                      >
                        {txn.amountInPaise >= 0 ? '+' : '−'}
                        {rupees(Math.abs(txn.amountInPaise))}
                      </span>
                    </div>
                  ))}
                  {transactions.walletTxns.length === 0 && (
                    <div className="p-8 text-center text-xs text-gray-400">
                      No wallet activity yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {visibleTab === 'promotions' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">
                    Awaiting approval ({pendingPromotions.length})
                  </h2>
                  <span className="text-[10px] font-bold text-gray-400">
                    Only approved, in-window offers reach customers
                  </span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {pendingPromotions.map((promotion) => (
                    <div
                      key={promotion.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-extrabold text-gray-900 dark:text-white">
                          {promotion.type.replace(/_/g, ' ')} • {promotion.brandName}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(promotion.startsAt).toLocaleString('en-IN')} →{' '}
                          {new Date(promotion.endsAt).toLocaleString('en-IN')}
                          {promotion.config?.discountPct !== undefined
                            ? ` • ${promotion.config.discountPct}% off`
                            : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPromotionStatus(promotion.id, 'APPROVED')}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setPromotionStatus(promotion.id, 'REJECTED')}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingPromotions.length === 0 && (
                    <div className="p-10 text-center text-xs text-gray-400">
                      No promotions are waiting for approval.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 text-sm font-extrabold text-gray-900 dark:text-white">
                  Reviewed promotions ({reviewedPromotions.length})
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {reviewedPromotions.map((promotion) => (
                    <div
                      key={promotion.id}
                      className="p-4 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {promotion.type.replace(/_/g, ' ')} • {promotion.brandName}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(promotion.startsAt).toLocaleDateString('en-IN')} →{' '}
                          {new Date(promotion.endsAt).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                          promotion.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : promotion.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {promotion.status}
                      </span>
                    </div>
                  ))}
                  {reviewedPromotions.length === 0 && (
                    <div className="p-10 text-center text-xs text-gray-400">
                      No reviewed promotions yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {visibleTab === 'audit' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-purple-500" />
                <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">
                  Audit trail ({auditLogs.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[640px] overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4 text-xs space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-black text-[10px] text-gray-600 dark:text-slate-300">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(log.createdAt).toLocaleString('en-IN')}
                      </span>
                      <span className="font-mono text-[10px] text-gray-400 ml-auto">
                        actor {String(log.actorId || '').slice(0, 10)} • record{' '}
                        {String(log.recordId || '').slice(0, 10)}
                      </span>
                    </div>
                    {log.diff && (
                      <pre className="text-[10px] text-gray-500 dark:text-slate-400 whitespace-pre-wrap break-all">
                        {JSON.stringify(log.diff)}
                      </pre>
                    )}
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <div className="p-10 text-center text-xs text-gray-400">
                    No audit entries yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
      {label}
    </span>
    {children}
  </label>
);

const Metric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
      {label}
    </div>
    <div className="text-xl font-black text-gray-900 dark:text-white">{value}</div>
  </div>
);
