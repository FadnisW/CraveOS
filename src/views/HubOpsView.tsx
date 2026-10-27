'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api-client';
import { useUser } from '../context/UserContext';
import {
  AlertCircle,
  ArrowRight,
  BadgeIndianRupee,
  Bike,
  CheckCircle2,
  ChefHat,
  LayoutDashboard,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Store,
  UserPlus,
  Users,
} from 'lucide-react';

interface Hub {
  id: string;
  name: string;
  city?: string;
}

type Tab = 'overview' | 'stock' | 'staff' | 'riders' | 'finance';

const TABS: { id: Tab; label: string; icon: React.ReactNode; managerOnly?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" />, managerOnly: true },
  { id: 'stock', label: 'Stock & 86', icon: <Package className="w-4 h-4" /> },
  { id: 'staff', label: 'Staff', icon: <Users className="w-4 h-4" />, managerOnly: true },
  { id: 'riders', label: 'Fleet', icon: <Bike className="w-4 h-4" />, managerOnly: true },
  { id: 'finance', label: 'Finance', icon: <BadgeIndianRupee className="w-4 h-4" />, managerOnly: true },
];

function rupees(paise: number | undefined | null) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

export const HubOpsView: React.FC<{ onNavigate?: (view: string) => void }> = ({ onNavigate }) => {
  const { user } = useUser();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [hubId, setHubId] = useState<string>('');
  const [tab, setTab] = useState<Tab>('stock');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<any>(null);
  const [stock, setStock] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [stockQuery, setStockQuery] = useState<string>('');

  const [userQuery, setUserQuery] = useState<string>('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [assignUserId, setAssignUserId] = useState<string>('');
  const [assignRole, setAssignRole] = useState<'HUB_STAFF' | 'HUB_MANAGER'>('HUB_STAFF');
  const [assigning, setAssigning] = useState<boolean>(false);

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'HUB_MANAGER' || isAdmin;
  const canAssignManager = isAdmin;

  const visibleTabs = useMemo(
    () => TABS.filter((candidate) => !candidate.managerOnly || isManager),
    [isManager],
  );

  useEffect(() => {
    if (!visibleTabs.some((candidate) => candidate.id === tab)) {
      setTab(visibleTabs[0]?.id || 'stock');
    }
  }, [tab, visibleTabs]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.hubOps
      .getHubs()
      .then((rows) => {
        if (cancelled) return;
        const available: Hub[] = Array.isArray(rows) ? rows : [];
        setHubs(available);
        const scoped = user?.scopedHubId
          ? available.find((hub) => hub.id === user.scopedHubId)
          : undefined;
        setHubId((current) => current || scoped?.id || available[0]?.id || '');
        if (available.length === 0) {
          setError('Your account is not assigned to a hub yet.');
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load your hubs.');
        if (user?.scopedHubId) setHubId(user.scopedHubId);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.scopedHubId]);

  const loadTab = useCallback(async () => {
    if (!hubId) return;
    setError(null);

    try {
      if (tab === 'overview') {
        setDashboard(await api.hubOps.getDashboard(hubId));
      } else if (tab === 'stock') {
        setStock(await api.hubOps.getStock(hubId));
      } else if (tab === 'staff') {
        setStaff(await api.hubOps.getStaff(hubId));
      } else if (tab === 'riders') {
        setRiders(await api.hubOps.getRiders(hubId));
      } else if (tab === 'finance') {
        setFinance(await api.hubOps.getFinance(hubId));
      }
    } catch (err: any) {
      setError(err?.message || `Failed to load ${tab}.`);
    }
  }, [hubId, tab]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  const refresh = () => loadTab();

  const toggleStock = async (brand: any, item: any) => {
    const next = !item.isAvailable;
    setSavingItemId(item.id);
    setStock((prev) =>
      prev.map((candidate) =>
        candidate.brandKitchenId !== brand.brandKitchenId
          ? candidate
          : {
              ...candidate,
              menuItems: candidate.menuItems.map((row: any) =>
                row.id === item.id ? { ...row, isAvailable: next } : row,
              ),
            },
      ),
    );

    try {
      await api.hubOps.bulkToggle86(hubId, [{ menuItemId: item.id, isAvailable: next }]);
    } catch (err: any) {
      setStock((prev) =>
        prev.map((candidate) =>
          candidate.brandKitchenId !== brand.brandKitchenId
            ? candidate
            : {
                ...candidate,
                menuItems: candidate.menuItems.map((row: any) =>
                  row.id === item.id ? { ...row, isAvailable: item.isAvailable } : row,
                ),
              },
        ),
      );
      setError(err?.message || 'Could not update availability.');
    } finally {
      setSavingItemId(null);
    }
  };

  const searchUsers = async () => {
    if (!userQuery.trim()) return;
    try {
      const rows = await api.admin.getUsers(userQuery.trim());
      setUserResults(Array.isArray(rows) ? rows : []);
      if (Array.isArray(rows) && rows.length === 0) {
        setError('No user matched that search.');
      }
    } catch (err: any) {
      setError(err?.message || 'User search is not available for this account.');
    }
  };

  const assignStaff = async () => {
    if (!hubId || !assignUserId.trim()) {
      setError('Enter the user id or pick a user from search.');
      return;
    }
    setAssigning(true);
    setError(null);
    setMessage(null);
    try {
      await api.hubOps.assignStaff(hubId, assignUserId.trim(), assignRole);
      setMessage(`${assignRole.replace('_', ' ')} assigned to this hub.`);
      setAssignUserId('');
      await loadTab();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Could not assign this user.');
    } finally {
      setAssigning(false);
    }
  };

  const filteredStock = stock
    .map((brand) => ({
      ...brand,
      menuItems: brand.menuItems.filter(
        (item: any) =>
          !stockQuery.trim() ||
          item.name.toLowerCase().includes(stockQuery.toLowerCase()) ||
          brand.brandName.toLowerCase().includes(stockQuery.toLowerCase()),
      ),
    }))
    .filter((brand) => brand.menuItems.length > 0);

  const selectedHub = hubs.find((hub) => hub.id === hubId);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center">
            <Store className="w-6 h-6 text-slate-900" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">Hub Operations Console</h1>
            <p className="text-xs text-slate-400">
              {selectedHub
                ? [selectedHub.name, selectedHub.city].filter(Boolean).join(' • ')
                : 'No hub selected'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hubs.length > 1 && (
            <select
              value={hubId}
              onChange={(event) => setHubId(event.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold"
            >
              {hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>
                  {hub.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={refresh}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {onNavigate && (
            <button
              onClick={() => onNavigate('admin-kds')}
              className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <ChefHat className="w-3.5 h-3.5" />
              Kitchen KDS
            </button>
          )}
        </div>
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

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-400">Loading hub…</div>
      ) : !hubId ? (
        <div className="p-12 text-center text-sm text-gray-400 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800">
          No hub is assigned to this account. Ask a super admin to set your scoped hub.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {visibleTabs.map((candidate) => (
              <button
                key={candidate.id}
                onClick={() => setTab(candidate.id)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  tab === candidate.id
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                }`}
              >
                {candidate.icon}
                {candidate.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  ['Active KDS orders', dashboard?.metrics?.activeKdsOrders],
                  ['Orders today', dashboard?.metrics?.todayOrders],
                  ['Riders staged', dashboard?.metrics?.stagedRiders],
                  ['Active trips', dashboard?.metrics?.activeTrips],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800"
                  >
                    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                      {label}
                    </div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">
                      {value ?? '—'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800">
                <h2 className="text-sm font-extrabold text-gray-900 dark:text-white mb-2">
                  Brand kitchens in this hub
                </h2>
                <div className="flex flex-wrap gap-2">
                  {(dashboard?.hub?.brands || []).map((brand: string) => (
                    <span
                      key={brand}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs font-bold text-amber-800 dark:text-amber-300"
                    >
                      {brand}
                    </span>
                  ))}
                  {(dashboard?.hub?.brands || []).length === 0 && (
                    <span className="text-xs text-gray-400">No brand kitchens linked.</span>
                  )}
                </div>
                <div className="mt-4 text-xs text-gray-500 dark:text-slate-400">
                  Operating hours:{' '}
                  {dashboard?.hub?.operatingHoursStart && dashboard?.hub?.operatingHoursEnd
                    ? `${dashboard.hub.operatingHoursStart} – ${dashboard.hub.operatingHoursEnd}`
                    : 'Not set'}
                </div>
              </div>
            </div>
          )}

          {tab === 'stock' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">
                  Stock & 86 management
                </h2>
                <div className="relative ml-auto w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={stockQuery}
                    onChange={(event) => setStockQuery(event.target.value)}
                    placeholder="Search item or brand…"
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="p-5 space-y-6">
                {filteredStock.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400">
                    No menu items match this hub.
                  </div>
                ) : (
                  filteredStock.map((brand) => (
                    <div key={brand.brandKitchenId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">
                          {brand.brandName}
                        </h3>
                        <span
                          className={`text-[10px] font-bold ${
                            brand.isOpen ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {brand.isOpen ? 'Kitchen open' : 'Kitchen closed'}
                        </span>
                      </div>
                      {brand.menuItems.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
                        >
                          <div>
                            <div className="text-xs font-bold text-gray-900 dark:text-white">
                              {item.name}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {item.category} • MRP {rupees(item.mrpInPaise)} • Member{' '}
                              {rupees(item.memberPriceInPaise)}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleStock(brand, item)}
                            disabled={savingItemId === item.id}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 ${
                              item.isAvailable
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {savingItemId === item.id
                              ? 'Saving…'
                              : item.isAvailable
                                ? 'Available'
                                : "86'd"}
                          </button>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'staff' && isManager && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 text-sm font-extrabold text-gray-900 dark:text-white">
                  Hub staff ({staff.length})
                </div>
                {staff.length === 0 ? (
                  <div className="p-10 text-center text-xs text-gray-400">
                    No staff assigned to this hub yet.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {staff.map((member) => (
                      <div
                        key={member.id}
                        className="p-4 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {member.name || member.email || member.phone}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {member.email || member.phone} • {member.role}
                          </div>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-gray-500 dark:text-slate-400">
                          {member.role === 'HUB_MANAGER' ? 'Manager' : 'Staff'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5 space-y-3 h-fit">
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-rose-500" />
                  Assign staff
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  {isAdmin
                    ? 'Search a registered user, then assign them to this hub.'
                    : 'Only hub staff can be added by a hub manager. Paste the user id from the super admin.'}
                </p>

                {isAdmin && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={userQuery}
                        onChange={(event) => setUserQuery(event.target.value)}
                        placeholder="Search name, email, phone"
                        className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                      />
                      <button
                        onClick={searchUsers}
                        className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold"
                      >
                        Find
                      </button>
                    </div>
                    {userResults.length > 0 && (
                      <select
                        value={assignUserId}
                        onChange={(event) => setAssignUserId(event.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                      >
                        <option value="">Select user…</option>
                        {userResults.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name || candidate.email} ({candidate.role})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <input
                  value={assignUserId}
                  onChange={(event) => setAssignUserId(event.target.value)}
                  placeholder="User id"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-mono text-gray-900 dark:text-white"
                />

                <select
                  value={assignRole}
                  onChange={(event) =>
                    setAssignRole(event.target.value as 'HUB_STAFF' | 'HUB_MANAGER')
                  }
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-900 dark:text-white"
                >
                  <option value="HUB_STAFF">Hub Staff</option>
                  {canAssignManager && <option value="HUB_MANAGER">Hub Manager</option>}
                </select>

                <button
                  onClick={assignStaff}
                  disabled={assigning}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  {assigning ? 'Assigning…' : 'Assign to this hub'}
                </button>
              </div>
            </div>
          )}

          {tab === 'riders' && isManager && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-slate-800 text-sm font-extrabold text-gray-900 dark:text-white">
                Staged fleet ({riders.length})
              </div>
              {riders.length === 0 ? (
                <div className="p-10 text-center text-xs text-gray-400">
                  No riders are staged at this hub.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
                  {riders.map((rider) => (
                    <div
                      key={rider.id}
                      className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-extrabold text-gray-900 dark:text-white">
                          {rider.name}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {rider.phone} • {rider.vehicleType || 'BIKE'} • {rider.status}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          rider.isOnline
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {rider.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'finance' && isManager && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Net collected
                </div>
                <div className="text-2xl font-black text-gray-900 dark:text-white">
                  {rupees(finance?.totalRevenuePaise)}
                </div>
                <div className="text-[10px] text-gray-400">
                  {finance?.totalOrders ?? 0} paid orders
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Average order
                </div>
                <div className="text-2xl font-black text-gray-900 dark:text-white">
                  {rupees(finance?.avgOrderValuePaise)}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Gateway
                </div>
                <div className="text-lg font-black text-gray-900 dark:text-white">
                  {rupees(finance?.byGateway?.RAZORPAY)}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
                <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Wallet
                </div>
                <div className="text-lg font-black text-gray-900 dark:text-white">
                  {rupees(finance?.byGateway?.WALLET)}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
