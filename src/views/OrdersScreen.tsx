'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Order, OrderStatus } from '../types';
import { api } from '../lib/api-client';
import { mapApiOrder, mapApiOrders } from '../lib/order-mapper';
import { useUser } from '../context/UserContext';
import {
  Clock,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Phone,
  ArrowLeft,
  RefreshCw,
  ChefHat,
  Bike,
  Radio,
  XCircle,
  PackageCheck,
  Receipt,
  KeyRound,
} from 'lucide-react';
import { io } from 'socket.io-client';

interface OrdersScreenProps {
  activeOrder: Order | null;
  onBackToHome: () => void;
}

const ACTIVE_STATUSES: OrderStatus[] = [
  'PENDING_CONFIRMATION',
  'PLACED',
  'ACCEPTED_BY_KITCHEN',
  'PREPARING',
  'RIDER_ASSIGNED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
];

const TIMELINE: { key: OrderStatus; label: string; icon: React.ElementType }[] = [
  { key: 'PLACED', label: 'Order Placed', icon: CheckCircle2 },
  { key: 'ACCEPTED_BY_KITCHEN', label: 'Kitchen Accepted', icon: ChefHat },
  { key: 'PREPARING', label: 'Preparing Fresh', icon: RefreshCw },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Bike },
  { key: 'DELIVERED', label: 'Delivered', icon: PackageCheck },
];

/** Maps a live order status onto the five-step customer timeline. */
function timelineIndex(status: OrderStatus): number {
  switch (status) {
    case 'PENDING_CONFIRMATION':
    case 'PLACED':
      return 0;
    case 'ACCEPTED_BY_KITCHEN':
      return 1;
    case 'PREPARING':
    case 'RIDER_ASSIGNED':
      return 2;
    case 'PICKED_UP':
    case 'OUT_FOR_DELIVERY':
      return 3;
    case 'DELIVERED':
      return 4;
    default:
      return -1;
  }
}

const BRAND_STATUS_STYLE: Record<string, string> = {
  SENT_TO_KITCHEN: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  ACCEPTED: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  PREPARING: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  READY: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  REJECTED: 'bg-slate-700 text-slate-300 border-slate-600',
};

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  activeOrder: initialOrder,
  onBackToHome,
}) => {
  const { user, token } = useUser();
  const [activeOrder, setActiveOrder] = useState<Order | null>(initialOrder);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [now, setNow] = useState<number>(() => Date.now());

  // Keep the delivery countdown honest while the page stays open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setActiveOrder(initialOrder);
  }, [initialOrder]);

  const refreshOrder = useCallback(async (orderId: string) => {
    try {
      const liveOrder = await api.getOrderById(orderId);
      setActiveOrder(mapApiOrder(liveOrder));
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not refresh the order.');
    }
  }, []);

  // Client reconnection recovery: if the tab was reloaded mid-order, pick the
  // most recent in-flight order back up from the server.
  useEffect(() => {
    if (activeOrder || !user?.id) return;

    let cancelled = false;

    api
      .getUserOrders(user.id)
      .then((result) => {
        if (cancelled) return;
        const orders = mapApiOrders(Array.isArray(result) ? result : []);
        const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
        const recovered = orders.find(
          (order) =>
            ACTIVE_STATUSES.includes(order.status) &&
            new Date(order.createdAt).getTime() >= sixHoursAgo,
        );

        if (recovered) {
          setActiveOrder(recovered);
        }
      })
      .catch((err: any) => {
        if (!cancelled) setLoadError(err?.message || 'Failed to recover your recent order.');
      });

    return () => {
      cancelled = true;
    };
  }, [activeOrder, user?.id]);

  // Live updates: socket events trigger a server re-read, and a slow poll keeps
  // the screen correct if the socket drops entirely.
  useEffect(() => {
    const orderId = activeOrder?.id;
    if (!orderId || !token) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      // Order rooms are authenticated; the token identifies the buyer.
      auth: { token },
    });

    socket.on('connect', () => {
      setIsLiveConnected(true);
      socket.emit('joinOrderRoom', orderId);
    });

    socket.on('disconnect', () => {
      setIsLiveConnected(false);
    });

    const handleStatusChange = () => {
      refreshOrder(orderId);
    };

    socket.on('orderStatusChanged', handleStatusChange);
    socket.on('tripAccepted', handleStatusChange);
    socket.on('riderPickedUp', handleStatusChange);
    socket.on('deliveryVerified', handleStatusChange);

    const poll = setInterval(() => {
      refreshOrder(orderId);
    }, 20_000);

    return () => {
      socket.off('orderStatusChanged', handleStatusChange);
      socket.off('tripAccepted', handleStatusChange);
      socket.off('riderPickedUp', handleStatusChange);
      socket.off('deliveryVerified', handleStatusChange);
      socket.disconnect();
      clearInterval(poll);
    };
  }, [activeOrder?.id, token, refreshOrder]);

  const currentStep = useMemo(
    () => (activeOrder ? timelineIndex(activeOrder.status) : -1),
    [activeOrder],
  );

  const isCancelled = activeOrder?.status === 'CANCELLED';
  const isDelivered = activeOrder?.status === 'DELIVERED';

  // The server stores a per-order estimate at checkout. Show the time that is
  // actually left, not the original estimate forever. If the server did not
  // produce an estimate, say so instead of inventing one.
  const remainingEtaMins = useMemo(() => {
    if (!activeOrder || isCancelled || isDelivered) return null;

    const target = activeOrder.estimatedDeliveryMins;
    if (typeof target !== 'number' || target <= 0) return null;

    const createdAt = new Date(activeOrder.createdAt).getTime();
    if (!Number.isFinite(createdAt)) return target;

    const elapsed = Math.max(0, Math.floor((now - createdAt) / 60_000));
    return Math.max(0, target - elapsed);
  }, [activeOrder, isCancelled, isDelivered, now]);

  const handleManualRefresh = async () => {
    if (!activeOrder) return;
    setRefreshing(true);
    await refreshOrder(activeOrder.id);
    setRefreshing(false);
  };

  if (!activeOrder) {
    return (
      <div className="text-center py-20 space-y-4">
        <Clock className="w-12 h-12 text-gray-400 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          No active orders right now
        </h2>
        {loadError && <p className="text-xs font-bold text-rose-600">{loadError}</p>}
        <button
          onClick={onBackToHome}
          className="px-6 py-2.5 rounded-xl bg-rose-600 text-white font-extrabold text-xs shadow-md hover:bg-rose-700 transition-colors"
        >
          Explore Menu
        </button>
      </div>
    );
  }

  const riderInitials = (activeOrder.rider?.name || 'R')
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const paymentLabel =
    activeOrder.paymentMethod === 'UNKNOWN'
      ? 'Not reported by the server'
      : activeOrder.paymentMethod;

  const etaLabel = isCancelled
    ? 'Cancelled'
    : isDelivered
      ? 'Delivered'
      : remainingEtaMins === null
        ? 'Awaiting estimate'
        : remainingEtaMins === 0
          ? 'Arriving soon'
          : `${remainingEtaMins} Mins`;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 text-xs font-bold transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Storefront</span>
        </button>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 text-xs font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 sm:p-8 text-white shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                {isCancelled ? 'Order Cancelled' : isDelivered ? 'Order Delivered' : 'Live Order Status'}
              </span>
              {isLiveConnected && !isDelivered && !isCancelled && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Radio className="w-3 h-3 text-emerald-400" /> Live
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              #{activeOrder.id.slice(0, 8)}
            </h1>
            <p className="text-[11px] text-slate-400">
              {new Date(activeOrder.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="px-5 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
              {isDelivered ? 'Completed' : isCancelled ? 'Status' : 'Delivery Target'}
            </span>
            <div
              className={`text-2xl sm:text-3xl font-black tabular-nums ${
                isCancelled ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {etaLabel}
            </div>
          </div>
        </div>

        {loadError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-300">
            {loadError}
          </div>
        )}

        {/* Timeline */}
        {isCancelled ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
            <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-rose-300">This order was cancelled</h3>
              <p className="text-[11px] text-rose-200/80">
                Any money actually collected is refunded to your wallet by the server.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2 pt-2">
            {TIMELINE.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index <= currentStep;
              return (
                <div key={step.key} className="flex flex-col items-center text-center space-y-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCompleted
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-bold line-clamp-1 ${
                      isCompleted ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Per-brand kitchen status */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
          <h3 className="text-xs font-bold text-slate-300">Brand preparation status</h3>
          {activeOrder.brandStatuses.length === 0 ? (
            <p className="text-[11px] text-slate-400">Waiting for kitchen tickets…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeOrder.brandStatuses.map((brandStatus) => (
                <div
                  key={brandStatus.brandId}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 text-xs border border-white/5 gap-2"
                >
                  <div>
                    <span className="font-bold text-white">{brandStatus.brandName}</span>
                    <span className="block text-[10px] text-slate-400">
                      {brandStatus.itemsCount} item(s)
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${
                      BRAND_STATUS_STYLE[brandStatus.status] || BRAND_STATUS_STYLE.SENT_TO_KITCHEN
                    }`}
                  >
                    {brandStatus.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delivery handover code — shown to the customer only, once the rider
            has collected the order. The rider types this in at the door. */}
        {activeOrder.deliveryOtp && !isDelivered && !isCancelled && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
              <KeyRound className="w-3.5 h-3.5" /> Delivery code
            </div>
            <div className="text-2xl font-black tracking-[0.35em] text-white">
              {activeOrder.deliveryOtp}
            </div>
            <p className="text-[11px] text-emerald-200/80">
              Share this 4-digit code with your rider only after you receive the order.
            </p>
          </div>
        )}

        {/* Rider card */}
        {activeOrder.rider ? (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/10 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center font-bold text-white shadow-md">
                {riderInitials}
              </div>
              <div>
                <h4 className="text-sm font-bold">{activeOrder.rider.name}</h4>
                <p className="text-xs text-slate-300">Delivery Executive</p>
              </div>
            </div>

            <a
              href={`tel:${activeOrder.rider.phone}`}
              className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold transition-colors shadow-lg"
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>
        ) : (
          !isDelivered &&
          !isCancelled && (
            <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-bold text-slate-300">
              <Bike className="w-4 h-4 text-slate-400" />
              A rider will be assigned once the kitchen accepts every ticket.
            </div>
          )
        )}

        {/* Real bill */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Order summary
          </h3>
          <div className="flex justify-between text-slate-400">
            <span>Item total (MRP)</span>
            <span>₹{activeOrder.mrpTotal.toFixed(0)}</span>
          </div>
          {activeOrder.memberSavings > 0 && (
            <div className="flex justify-between text-emerald-400 font-bold">
              <span>Member savings</span>
              <span>-₹{activeOrder.memberSavings.toFixed(0)}</span>
            </div>
          )}
          {activeOrder.couponDiscount > 0 && (
            <div className="flex justify-between text-emerald-400 font-bold">
              <span>Coupon</span>
              <span>-₹{activeOrder.couponDiscount.toFixed(0)}</span>
            </div>
          )}
          {activeOrder.walletDiscount > 0 && (
            <div className="flex justify-between text-emerald-400 font-bold">
              <span>Wallet applied</span>
              <span>-₹{activeOrder.walletDiscount.toFixed(0)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-400">
            <span>Delivery, packaging &amp; taxes</span>
            <span>
              ₹
              {(
                activeOrder.deliveryFee +
                activeOrder.packagingFee +
                activeOrder.tax
              ).toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-white/10 text-sm font-black text-white">
            <span>Order total</span>
            <span>₹{activeOrder.finalPaidAmount.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 pt-1">
            <span>Payment method</span>
            <span>{paymentLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Server-verified pricing</span>
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 text-xs">
          <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white">{activeOrder.deliveryAddress.label}</span>
            <p className="text-slate-400">{activeOrder.deliveryAddress.addressLine}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
