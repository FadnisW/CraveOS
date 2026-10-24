import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { ShoppingBag, Users, Bike, AlertCircle, Ticket, Activity, RefreshCw } from 'lucide-react';

export const AdminDashboardView: React.FC = () => {
  const [kpis, setKpis] = useState<any>(null);
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // No fake fallbacks: an unreachable API must read as an error, not as
      // invented KPIs that make the console look healthy while it is offline.
      const [kpiData, ordersData] = await Promise.all([
        api.admin.getDashboardKPIs(),
        api.admin.getLiveOrdersMap(),
      ]);
      setKpis(kpiData);
      setLiveOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data');
      setKpis(null);
      setLiveOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Activity className="w-6 h-6 text-rose-500" />
            CraveOS Central Operations Console
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time platform overview across all hubs, brands, riders, and support tickets
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">Total Orders</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {kpis?.totalOrders ?? '—'}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
              Today: {kpis?.todayOrders ?? 0}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">Online Riders</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {kpis?.activeRiders ?? '—'}
            </div>
            <div className="text-[10px] text-gray-400 font-medium mt-0.5">Active staged riders</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">KYC Queue</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {kpis?.pendingRiderApprovals ?? '—'}
            </div>
            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
              Pending review
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">Open Tickets</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {kpis?.openTickets ?? '—'}
            </div>
            <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-0.5">
              Support queue
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">Active Trips</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {kpis ? liveOrders.length : '—'}
            </div>
            <div className="text-[10px] text-gray-400 font-medium mt-0.5">
              {error ? 'API unreachable' : 'Live delivery trips'}
            </div>
          </div>
        </div>
      </div>

      {/* Live Active Delivery Trips Monitor */}
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
              <div key={trip.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                      Order #{trip.orderId.substring(0, 8)}
                    </span>
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium">
                      Trip Status: <strong className="text-rose-600 dark:text-rose-400">{trip.status}</strong>
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    Customer: <span className="font-medium text-gray-700 dark:text-slate-300">{trip.order?.user?.name || 'Guest'}</span> ({trip.order?.user?.phone || 'N/A'})
                  </div>
                  <div className="text-xs text-gray-400">
                    Hub: {trip.order?.hub?.name || trip.order?.hubId} • Delivery Address: {trip.order?.address?.addressLine || 'Stored Address'}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
                    <div className="text-gray-400 text-[10px] uppercase font-bold">Assigned Rider</div>
                    <div className="font-bold text-gray-900 dark:text-white">
                      {trip.rider ? `${trip.rider.name} (${trip.rider.phone})` : 'Unassigned'}
                    </div>
                    {trip.rider?.liveLat && (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        GPS: {trip.rider.liveLat.toFixed(4)}, {trip.rider.liveLng.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
