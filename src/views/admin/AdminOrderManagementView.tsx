import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { ShoppingBag, RefreshCw, AlertCircle, Bike, CheckCircle } from 'lucide-react';

export const AdminOrderManagementView: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Rider Reassignment Modal State
  const [reassignOrder, setReassignOrder] = useState<any | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [reassigning, setReassigning] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchOrdersData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersData, ridersData] = await Promise.all([
        api.admin.getOrders({ status: statusFilter || undefined }),
        api.riders.getAll().catch(() => []),
      ]);
      setOrders(ordersData);
      setRiders(ridersData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch platform orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersData();
  }, [statusFilter]);

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignOrder || !selectedRiderId) return;

    setReassigning(true);
    try {
      await api.admin.manuallyReassignRider(reassignOrder.id, selectedRiderId);
      setSuccessMsg(`Successfully reassigned Rider to Order #${reassignOrder.id.substring(0, 8)}`);
      setReassignOrder(null);
      setSelectedRiderId('');
      fetchOrdersData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to reassign rider');
    } finally {
      setReassigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-rose-500" />
            Platform Order Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor multi-brand orders, kitchen fan-outs, delivery trip status, and perform manual rider reassignment
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
          >
            <option value="">All Order Statuses</option>
            <option value="PLACED">PLACED</option>
            <option value="ACCEPTED_BY_KITCHEN">ACCEPTED_BY_KITCHEN</option>
            <option value="PREPARING">PREPARING</option>
            <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          <button
            onClick={fetchOrdersData}
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-rose-600/30"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Orders List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 font-bold text-gray-900 dark:text-white">
          Orders ({orders.length})
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 dark:text-slate-500 text-sm">
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400 dark:text-slate-500 text-sm">
            No orders found matching status filter.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {orders.map((o) => (
              <div key={o.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-sm text-gray-900 dark:text-white">
                      #{o.id.substring(0, 8)}
                    </span>
                    <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      {o.status}
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                      ₹{((o.finalPaidPaise || 0) / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    Customer: <span className="font-bold text-gray-700 dark:text-slate-200">{o.user?.name || 'Guest'}</span> ({o.user?.phone || o.user?.email || 'N/A'})
                  </div>

                  {/* Brand Tickets Fan-out breakdown */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {o.brandOrders?.map((bo: any) => (
                      <span key={bo.id} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {bo.brandName || bo.brandId}: <strong>{bo.status}</strong> ({bo.items?.length || 0} items)
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Delivery Trip Details */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 text-xs">
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Delivery Partner</div>
                    <div className="font-bold text-gray-900 dark:text-white">
                      {o.deliveryTrip?.rider ? o.deliveryTrip.rider.name : 'Unassigned'}
                    </div>
                    {o.deliveryTrip && (
                      <div className="text-[10px] text-rose-500 font-bold">
                        Trip Status: {o.deliveryTrip.status}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setReassignOrder(o);
                      setSelectedRiderId(o.deliveryTrip?.riderId || '');
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Bike className="w-3.5 h-3.5 text-emerald-400" />
                    Reassign Rider
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reassign Rider Modal */}
      {reassignOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-gray-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Bike className="w-5 h-5 text-emerald-500" />
                Reassign Rider for Order #{reassignOrder.id.substring(0, 8)}
              </h3>
              <button
                onClick={() => setReassignOrder(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Select Approved Rider
                </label>
                <select
                  value={selectedRiderId}
                  onChange={(e) => setSelectedRiderId(e.target.value)}
                  required
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none"
                >
                  <option value="">-- Choose Rider --</option>
                  {riders
                    .filter((r) => r.status === 'APPROVED')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.phone}) {r.isOnline ? '🟢 Online' : '⚪ Offline'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning || !selectedRiderId}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {reassigning ? 'Reassigning...' : 'Assign Rider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
