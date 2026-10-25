'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { useUser } from '../../context/UserContext';
import { hasAdminSubRole, roleLabel } from '../../lib/roles';
import {
  ShoppingBag,
  Users,
  Bike,
  AlertCircle,
  Ticket,
  Activity,
  RefreshCw,
  TrendingUp,
  PieChart,
} from 'lucide-react';

function rupees(paise: number | undefined | null) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString('en-IN')}`;
}

export const AdminDashboardView: React.FC = () => {
  const { user } = useUser();

  const [kpis, setKpis] = useState<any>(null);
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [distribution, setDistribution] = useState<any>(null);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canSeeLiveOrders = hasAdminSubRole(user, 'OPERATIONS_ADMIN');
  const canSeeDistribution = hasAdminSubRole(
    user,
    'OPERATIONS_ADMIN',
    'FINANCE_ADMIN',
    'MARKETING_ADMIN',
  );
  const canSeeRevenue = hasAdminSubRole(user, 'FINANCE_ADMIN');

  /**
   * Each panel loads independently. A support or finance admin is not
   * allowed to read live trips, and the old Promise.all turned that single
   * 403 into an empty dashboard for the whole account.
   */
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      api.admin.getDashboardKPIs(),
      canSeeLiveOrders ? api.admin.getLiveOrdersMap() : Promise.resolve([]),
      canSeeDistribution ? api.admin.getOrderDistribution() : Promise.resolve(null),
      canSeeRevenue ? api.admin.getRevenueTrend() : Promise.resolve([]),
    ]);

    const [kpiResult, liveResult, distributionResult, revenueResult] = results;
    const failures: string[] = [];

    if (kpiResult.status === 'fulfilled') {
      setKpis(kpiResult.value);
    } else {
      setKpis(null);
      failures.push(kpiResult.reason?.message || 'KPIs unavailable');
    }

    if (liveResult.status === 'fulfilled') {
      setLiveOrders(Array.isArray(liveResult.value) ? liveResult.value : []);
    } else {
      setLiveOrders([]);
      failures.push(liveResult.reason?.message || 'Live trips unavailable');
    }

    if (distributionResult.status === 'fulfilled') {
      setDistribution(distributionResult.value || null);
    } else {
      setDistribution(null);
    }

    if (revenueResult.status === 'fulfilled') {
      setRevenueTrend(Array.isArray(revenueResult.value) ? revenueResult.value : []);
    } else {
      setRevenueTrend([]);
    }

    if (failures.length > 0) setError(failures.join(' • '));
    setLoading(false);
  }, [canSeeLiveOrders, canSeeDistribution, canSeeRevenue]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const brandRows: any[] = Array.isArray(distribution?.brands) ? distribution.brands : [];
  const hubRows: any[] = Array.isArray(distribution?.hubs) ? distribution.hubs : [];
  const trendRows: any[] = Array.isArray(revenueTrend) ? revenueTrend : [];
  const maxTrend = Math.max(1, ...trendRows.map((row) => Number(row.revenuePaise) || 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Activity className="w-6 h-6 text-rose-500" />
            CraveOS Operations Console
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {roleLabel(user)} view • live platform health, orders, riders and support
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/30 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Dashboard
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<ShoppingBag className="w-6 h-6" />}
          tone="blue"
          label="Total Orders"
          value={kpis?.totalOrders ?? '—'}
          hint={`Today: ${kpis?.todayOrders ?? 0}`}
        />
        <KpiCard
          icon={<Bike className="w-6 h-6" />}
          tone="emerald"
          label="Online Riders"
          value={kpis?.activeRiders ?? '—'}
          hint="Approved & staged"
        />
        <KpiCard
          icon={<Users className="w-6 h-6" />}
          tone="amber"
          label="KYC Queue"
          value={kpis?.pendingRiderApprovals ?? '—'}
          hint="Pending review"
        />
        <KpiCard
          icon={<Ticket className="w-6 h-6" />}
          tone="purple"
          label="Open Tickets"
          value={kpis?.openTickets ?? '—'}
          hint="Support queue"
        />
        <KpiCard
          icon={<Activity className="w-6 h-6" />}
          tone="rose"
          label="Active Trips"
          value={canSeeLiveOrders ? liveOrders.length : '—'}
          hint={canSeeLiveOrders ? 'Live delivery trips' : 'Operations only'}
        />
      </div>

      {canSeeRevenue && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">7-Day Revenue Trend</h2>
          </div>
          {trendRows.length === 0 ? (
            <div className="p-10 text-center text-gray-400 dark:text-slate-500 text-sm">
              No settled revenue in the last 7 days.
            </div>
          ) : (
            <div className="p-5 space-y-3">
              {trendRows.map((row, index) => {
                const value = Number(row.revenuePaise) || 0;
                const label = row.date || row.day || `Day ${index + 1}`;
                return (
                  <div key={`${label}-${index}`} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[11px] font-bold text-gray-500 dark:text-slate-400">
                      {label}
                    </span>
                    <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                        style={{ width: `${Math.max(2, (value / maxTrend) * 100)}%` }}
                      />
                    </div>
                    <span className="w-24 text-right text-xs font-bold text-gray-900 dark:text-white">
                      {rupees(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {canSeeDistribution && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-rose-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Orders by Brand</h2>
            </div>
            {brandRows.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No distribution data.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {brandRows.map((row, index) => (
                  <div
                    key={row.brandId || row.id || index}
                    className="px-5 py-3 flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-gray-800 dark:text-slate-200">
                      {row.brandName || row.name || row.brandId || 'Brand'}
                    </span>
                    <span className="text-gray-500 dark:text-slate-400">
                      {row.orderCount ?? row.orders ?? 0} orders
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Orders by Hub</h2>
            </div>
            {hubRows.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No hub distribution data.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {hubRows.map((row, index) => (
                  <div
                    key={row.hubId || row.id || index}
                    className="px-5 py-3 flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-gray-800 dark:text-slate-200">
                      {row.hubName || row.name || row.hubId || 'Hub'}
                    </span>
                    <span className="text-gray-500 dark:text-slate-400">
                      {row.orderCount ?? row.orders ?? 0} orders
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {canSeeLiveOrders && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Bike className="w-5 h-5 text-emerald-500" />
              Live Active Delivery Trips ({liveOrders.length})
            </h2>
            <span className="text-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-2.5 py-1 rounded-full animate-pulse">
              LIVE MONITOR
            </span>
          </div>

          {liveOrders.length === 0 ? (
            <div className="p-12 text-center text-gray-400 dark:text-slate-500 text-sm">
              No active delivery trips in flight right now.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {liveOrders.map((trip: any) => (
                <div
                  key={trip.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                        Order #{(trip.orderId || '').substring(0, 8)}
                      </span>
                      <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium">
                        Trip: <strong className="text-rose-600 dark:text-rose-400">{trip.status}</strong>
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      Customer:{' '}
                      <span className="font-medium text-gray-700 dark:text-slate-300">
                        {trip.order?.user?.name || 'Guest'}
                      </span>{' '}
                      ({trip.order?.user?.phone || 'N/A'})
                    </div>
                    <div className="text-xs text-gray-400">
                      Hub: {trip.order?.hub?.name || trip.order?.hubId} •{' '}
                      {trip.order?.address?.addressLine || 'Stored Address'}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 text-xs">
                    <div className="text-gray-400 text-[10px] uppercase font-bold">Assigned Rider</div>
                    <div className="font-bold text-gray-900 dark:text-white">
                      {trip.rider ? `${trip.rider.name} (${trip.rider.phone})` : 'Unassigned'}
                    </div>
                    {trip.rider?.liveLat && (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        GPS: {Number(trip.rider.liveLat).toFixed(4)},{' '}
                        {Number(trip.rider.liveLng).toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TONE: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
  purple: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
  rose: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400',
};

const KpiCard: React.FC<{
  icon: React.ReactNode;
  tone: keyof typeof TONE;
  label: string;
  value: React.ReactNode;
  hint: string;
}> = ({ icon, tone, label, value, hint }) => (
  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${TONE[tone]}`}>
      {icon}
    </div>
    <div>
      <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">{label}</div>
      <div className="text-2xl font-black text-gray-900 dark:text-white">{value}</div>
      <div className="text-[10px] text-gray-400 font-medium mt-0.5">{hint}</div>
    </div>
  </div>
);
