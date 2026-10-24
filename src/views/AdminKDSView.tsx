'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  RefreshCw,
  XCircle,
  ArrowLeft,
  ShieldAlert,
  AlertCircle,
  Utensils,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { io } from 'socket.io-client';
import { api } from '../lib/api-client';
import { useUser } from '../context/UserContext';

type TicketStatus = 'SENT_TO_KITCHEN' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED';

interface KDSTicketItem {
  id: string;
  name: string;
  quantity: number;
  priceInPaise: number;
}

interface KDSTicket {
  id: string;
  orderId: string;
  brandId: string;
  brandName: string;
  status: TicketStatus;
  items: KDSTicketItem[];
  order: {
    id: string;
    status: string;
    createdAt: string;
    paymentMethod: string;
    isSettled: boolean;
    trip?: { id: string; status: string; riderId?: string | null } | null;
  };
}

interface Hub {
  id: string;
  name: string;
  city?: string;
}

interface StockItem {
  id: string;
  name: string;
  category: string;
  mrpInPaise: number;
  memberPriceInPaise: number;
  isAvailable: boolean;
}

interface StockBrand {
  brandKitchenId: string;
  brandId: string;
  brandName: string;
  isOpen: boolean;
  menuItems: StockItem[];
}

interface AdminKDSViewProps {
  onBackToStorefront: () => void;
}

const NEXT_STATUS: Partial<Record<TicketStatus, { status: TicketStatus; label: string }>> = {
  SENT_TO_KITCHEN: { status: 'ACCEPTED', label: 'Accept Ticket' },
  ACCEPTED: { status: 'PREPARING', label: 'Start Cooking' },
  PREPARING: { status: 'READY', label: 'Mark Ready for Rider' },
};

const STATUS_STYLE: Record<TicketStatus, string> = {
  SENT_TO_KITCHEN: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  ACCEPTED: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  PREPARING: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  READY: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  REJECTED: 'bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  SENT_TO_KITCHEN: 'New ticket',
  ACCEPTED: 'Accepted',
  PREPARING: 'Cooking',
  READY: 'Ready',
  REJECTED: 'Rejected',
};

function elapsedMinutes(createdAt: string, now: number) {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((now - created) / 60000));
}

export const AdminKDSView: React.FC<AdminKDSViewProps> = ({ onBackToStorefront }) => {
  const { user } = useUser();

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [hubId, setHubId] = useState<string>('');
  const [tickets, setTickets] = useState<KDSTicket[]>([]);
  const [stock, setStock] = useState<StockBrand[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stockLoading, setStockLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [savingStockItemId, setSavingStockItemId] = useState<string | null>(null);
  const [activeBrandFilter, setActiveBrandFilter] = useState<string>('all');
  const [showStockModal, setShowStockModal] = useState<boolean>(false);
  const [stockQuery, setStockQuery] = useState<string>('');
  const [now, setNow] = useState<number>(Date.now());

  // Elapsed SLA counters need a tick, but nothing else here does.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Resolve the hub the operator is allowed to work in.
  useEffect(() => {
    let cancelled = false;

    api.hubOps
      .getHubs()
      .then((result) => {
        if (cancelled) return;
        const available: Hub[] = Array.isArray(result) ? result : [];
        setHubs(available);

        const scoped = user?.scopedHubId
          ? available.find((hub) => hub.id === user.scopedHubId)
          : undefined;

        setHubId((current) => current || scoped?.id || available[0]?.id || '');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load hubs for this account.');
        // A scoped hub manager can still work if the hub list call fails.
        if (user?.scopedHubId) setHubId(user.scopedHubId);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.scopedHubId]);

  const fetchTickets = useCallback(async () => {
    if (!hubId) {
      setTickets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.hubOps.getKdsTickets(hubId);
      setTickets(Array.isArray(result) ? result : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load kitchen tickets.');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [hubId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Live ticket board: the kitchen joins the hub KDS room and refreshes when
  // any ticket changes. Polling alone would show stale tickets after a reject.
  useEffect(() => {
    if (!hubId) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      socket.emit('joinHubKdsRoom', hubId);
    });

    const refresh = () => {
      fetchTickets();
    };

    socket.on('kdsTicketUpdated', refresh);
    socket.on('riderArrivedAtHub', refresh);
    socket.on('riderPickedUp', refresh);

    return () => {
      socket.off('kdsTicketUpdated', refresh);
      socket.off('riderArrivedAtHub', refresh);
      socket.off('riderPickedUp', refresh);
      socket.disconnect();
    };
  }, [hubId, fetchTickets]);

  const loadStock = useCallback(async () => {
    if (!hubId) return;
    setStockLoading(true);
    try {
      const result = await api.hubOps.getStock(hubId);
      setStock(Array.isArray(result) ? result : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load the hub stock list.');
    } finally {
      setStockLoading(false);
    }
  }, [hubId]);

  const openStockModal = () => {
    setShowStockModal(true);
    setStockQuery('');
    loadStock();
  };

  const handleUpdateStatus = async (
    ticket: KDSTicket,
    status: TicketStatus,
    rejectReason?: string,
  ) => {
    setPendingTicketId(ticket.id);
    setError(null);
    setActionMsg(null);

    try {
      await api.updateBrandOrderStatus(ticket.id, status, rejectReason);
      setActionMsg(
        status === 'REJECTED'
          ? `Ticket ${ticket.id.slice(0, 8)} rejected and the customer refunded.`
          : `Ticket ${ticket.id.slice(0, 8)} moved to ${STATUS_LABEL[status]}.`,
      );
      await fetchTickets();
    } catch (err: any) {
      setError(err?.message || 'Failed to update the kitchen ticket.');
    } finally {
      setPendingTicketId(null);
    }
  };

  const handleReject = (ticket: KDSTicket) => {
    if (typeof window === 'undefined') return;
    const reason = window.prompt(
      'Why is this ticket being rejected? The collected amount is refunded.',
      'Item unavailable',
    );
    if (reason === null) return;
    handleUpdateStatus(ticket, 'REJECTED', reason.trim() || 'Item unavailable');
  };

  const toggleStockItem = async (brandId: string, item: StockItem) => {
    if (!hubId) return;

    const nextAvailability = !item.isAvailable;
    setSavingStockItemId(item.id);
    setError(null);

    // Optimistic toggle; reverted if the server rejects it.
    setStock((prev) =>
      prev.map((brand) =>
        brand.brandId !== brandId
          ? brand
          : {
              ...brand,
              menuItems: brand.menuItems.map((candidate) =>
                candidate.id === item.id
                  ? { ...candidate, isAvailable: nextAvailability }
                  : candidate,
              ),
            },
      ),
    );

    try {
      await api.hubOps.bulkToggle86(hubId, [
        { menuItemId: item.id, isAvailable: nextAvailability },
      ]);
    } catch (err: any) {
      setStock((prev) =>
        prev.map((brand) =>
          brand.brandId !== brandId
            ? brand
            : {
                ...brand,
                menuItems: brand.menuItems.map((candidate) =>
                  candidate.id === item.id
                    ? { ...candidate, isAvailable: item.isAvailable }
                    : candidate,
                ),
              },
        ),
      );
      setError(err?.message || 'Failed to update item availability.');
    } finally {
      setSavingStockItemId(null);
    }
  };

  const brands = useMemo(() => {
    const map = new Map<string, string>();
    tickets.forEach((ticket) => map.set(ticket.brandId, ticket.brandName));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [tickets]);

  const filteredTickets =
    activeBrandFilter === 'all'
      ? tickets
      : tickets.filter((ticket) => ticket.brandId === activeBrandFilter);

  const outOfStockCount = stock.reduce(
    (sum, brand) => sum + brand.menuItems.filter((item) => !item.isAvailable).length,
    0,
  );

  const filteredStock = stock
    .map((brand) => ({
      ...brand,
      menuItems: brand.menuItems.filter(
        (item) =>
          !stockQuery.trim() ||
          item.name.toLowerCase().includes(stockQuery.toLowerCase()) ||
          brand.brandName.toLowerCase().includes(stockQuery.toLowerCase()),
      ),
    }))
    .filter((brand) => brand.menuItems.length > 0);

  const selectedHub = hubs.find((hub) => hub.id === hubId);
  const canManageStock = ['ADMIN', 'HUB_MANAGER', 'HUB_STAFF'].includes(user?.role || '');

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center font-bold text-white shadow-md">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold">Kitchen Display System (KDS)</h1>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                {selectedHub ? selectedHub.name : 'No hub selected'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live multi-brand tickets, payment-gated preparation &amp; 86 management
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {hubs.length > 1 && (
            <select
              value={hubId}
              onChange={(event) => {
                setHubId(event.target.value);
                setActiveBrandFilter('all');
                setStock([]);
              }}
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
            onClick={fetchTickets}
            disabled={loading || !hubId}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {canManageStock && (
            <button
              onClick={openStockModal}
              disabled={!hubId}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 disabled:opacity-50"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Manage 86&apos;d Items</span>
            </button>
          )}

          <button
            onClick={onBackToStorefront}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Storefront</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {actionMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {!hubId && !loading && (
        <div className="p-10 text-center text-sm text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-3xl border border-gray-200 dark:border-slate-700">
          Your account is not scoped to a hub. Ask an administrator to assign you to a hub
          before opening the kitchen display.
        </div>
      )}

      {hubId && (
        <>
          {/* Brand Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveBrandFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                activeBrandFilter === 'all'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
              }`}
            >
              All Brands ({tickets.length})
            </button>
            {brands.map((brand) => (
              <button
                key={brand.id}
                onClick={() => setActiveBrandFilter(brand.id)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                  activeBrandFilter === brand.id
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                }`}
              >
                {brand.name}
              </button>
            ))}
          </div>

          {/* KDS Tickets Grid */}
          {loading && tickets.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">Loading kitchen tickets…</div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-12 text-center space-y-2 bg-white dark:bg-slate-800 rounded-3xl border border-gray-200 dark:border-slate-700">
              <Utensils className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="text-sm font-bold text-gray-500 dark:text-slate-400">
                No live kitchen tickets
              </p>
              <p className="text-xs text-gray-400">
                Settled orders appear here the moment they are placed.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTickets.map((ticket) => {
                const mins = elapsedMinutes(ticket.order.createdAt, now);
                const isUrgent = mins > 10 && ticket.status !== 'READY';
                const next = NEXT_STATUS[ticket.status];
                const unpaid = !ticket.order.isSettled;
                const isBusy = pendingTicketId === ticket.id;

                return (
                  <motion.div
                    key={ticket.id}
                    layout
                    className={`rounded-3xl border overflow-hidden shadow-sm space-y-4 p-6 bg-white dark:bg-slate-800 ${
                      isUrgent
                        ? 'border-amber-500/80 ring-2 ring-amber-500/20'
                        : 'border-gray-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-3">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          {ticket.brandName}
                        </span>
                        <h3 className="text-base font-black text-gray-900 dark:text-white">
                          #{ticket.id.slice(0, 8)}
                        </h3>
                        <span className="text-[10px] text-gray-400">
                          Order #{ticket.orderId.slice(0, 8)} • {ticket.order.paymentMethod}
                        </span>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-black ${STATUS_STYLE[ticket.status]}`}
                        >
                          {STATUS_LABEL[ticket.status]}
                        </span>
                        <span
                          className={`text-[10px] font-bold flex items-center gap-1 ${
                            isUrgent
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-gray-400 dark:text-slate-400'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {mins}m
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {ticket.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between text-xs font-semibold"
                        >
                          <div>
                            <span className="text-gray-900 dark:text-white font-extrabold">
                              {item.quantity}x{' '}
                            </span>
                            <span className="text-gray-800 dark:text-slate-200">{item.name}</span>
                          </div>
                          <span className="text-gray-400 dark:text-slate-400">
                            ₹{(item.priceInPaise / 100).toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {unpaid && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                        <Wallet className="w-3.5 h-3.5 shrink-0" />
                        Awaiting payment — the kitchen cannot start this ticket yet.
                      </div>
                    )}

                    <div className="pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2">
                      {next && (
                        <button
                          onClick={() => handleUpdateStatus(ticket, next.status)}
                          disabled={isBusy || unpaid}
                          className={`flex-1 py-2 rounded-xl text-white text-xs font-extrabold flex items-center justify-center gap-1 shadow-sm disabled:opacity-40 ${
                            next.status === 'READY'
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : 'bg-rose-600 hover:bg-rose-700'
                          }`}
                        >
                          <ChefHat className="w-3.5 h-3.5" />
                          {isBusy ? 'Updating…' : next.label}
                        </button>
                      )}

                      {ticket.status === 'READY' && (
                        <div className="w-full py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-center text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                          ✓ Packed &amp; waiting at the dispatch bay
                        </div>
                      )}

                      {ticket.status === 'REJECTED' && (
                        <div className="w-full py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-center text-xs font-extrabold text-rose-700 dark:text-rose-300">
                          ✕ Rejected
                        </div>
                      )}

                      {ticket.status !== 'READY' && ticket.status !== 'REJECTED' && (
                        <button
                          onClick={() => handleReject(ticket)}
                          disabled={isBusy}
                          className="py-2 px-3 rounded-xl bg-gray-100 hover:bg-rose-50 text-gray-500 hover:text-rose-600 text-xs font-bold disabled:opacity-40"
                          title="Reject ticket and refund the customer"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 86'd Out-of-Stock Item Manager Modal */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Mark Items Out of Stock (&quot;86&quot;)
              </h3>
              <button
                onClick={() => setShowStockModal(false)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400">
              Availability changes apply immediately to every storefront served by this hub.
              {outOfStockCount > 0 && (
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {' '}
                  {outOfStockCount} item(s) currently 86&apos;d.
                </span>
              )}
            </p>

            <input
              type="text"
              value={stockQuery}
              onChange={(event) => setStockQuery(event.target.value)}
              placeholder="Search items or brands…"
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
            />

            <div className="max-h-72 overflow-y-auto space-y-4 pr-1">
              {stockLoading ? (
                <div className="p-8 text-center text-xs text-gray-400">Loading hub stock…</div>
              ) : filteredStock.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  No menu items match this hub.
                </div>
              ) : (
                filteredStock.map((brand) => (
                  <div key={brand.brandKitchenId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">
                        {brand.brandName}
                      </h4>
                      <span
                        className={`text-[10px] font-bold ${
                          brand.isOpen ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {brand.isOpen ? 'Kitchen open' : 'Kitchen closed'}
                      </span>
                    </div>

                    {brand.menuItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs"
                      >
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            {item.category} • ₹{(item.memberPriceInPaise / 100).toFixed(0)} member
                          </span>
                        </div>

                        <button
                          onClick={() => toggleStockItem(brand.brandId, item)}
                          disabled={savingStockItemId === item.id}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                            item.isAvailable
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {savingStockItemId === item.id
                            ? 'Saving…'
                            : item.isAvailable
                              ? 'Available'
                              : "86'd (Out of Stock)"}
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowStockModal(false)}
              className="w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-extrabold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
