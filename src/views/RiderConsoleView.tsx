'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api-client';
import { useUser } from '../context/UserContext';
import {
  AlertCircle,
  BadgeIndianRupee,
  Bike,
  CheckCircle2,
  Clock,
  FileCheck2,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Power,
  RefreshCw,
  Route,
  ShieldAlert,
  Truck,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react';

type Tab = 'delivery' | 'history' | 'earnings' | 'profile';

const TRIP_LABEL: Record<string, string> = {
  ASSIGNED: 'New assignment',
  ACCEPTED: 'Heading to hub',
  ARRIVED_AT_HUB: 'At hub — collect order',
  PICKED_UP: 'Out for delivery',
  ARRIVING: 'At customer',
  DELIVERED: 'Delivered',
  UNASSIGNED: 'Awaiting rider',
  CANCELLED: 'Cancelled',
};

const TRIP_STYLE: Record<string, string> = {
  ASSIGNED: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  ACCEPTED: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  ARRIVED_AT_HUB: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  PICKED_UP: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  ARRIVING: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  DELIVERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  CANCELLED: 'bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-slate-300',
};

const RIDER_STATUS_STYLE: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  SUSPENDED: 'bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-slate-300',
};

function rupees(paise: number | undefined | null) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

function shortId(value: string | undefined | null) {
  return String(value || '').slice(0, 8);
}

function errorText(err: any, fallback: string) {
  return err?.message || fallback;
}

function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('This device cannot report a GPS location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => reject(new Error('Location permission is required to confirm arrival.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  });
}

export const RiderConsoleView: React.FC = () => {
  const { user } = useUser();
  const riderId = user?.id || '';

  const [rider, setRider] = useState<any>(null);
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [hubs, setHubs] = useState<any[]>([]);

  const [tab, setTab] = useState<Tab>('delivery');
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [deliveryOtp, setDeliveryOtp] = useState<string>('');
  const [showReject, setShowReject] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [kycDraft, setKycDraft] = useState({
    vehicleType: 'BIKE',
    vehicleRegNo: '',
    licenceDocUrl: '',
    vehicleRcDocUrl: '',
  });
  const [bankDraft, setBankDraft] = useState({ upiId: '', bankAccountRef: '' });

  const load = useCallback(async () => {
    if (!riderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const [riderResult, tripResult, historyResult, earningsResult, hubsResult] =
      await Promise.allSettled([
        api.riders.getById(riderId),
        api.getRiderActiveTrip(riderId),
        api.getRiderTripHistory(riderId),
        api.riders.getEarnings(riderId),
        api.riders.getHubs(),
      ]);

    if (riderResult.status === 'fulfilled') {
      const nextRider: any = riderResult.value;
      setRider(nextRider);
      setKycDraft({
        vehicleType: nextRider?.vehicleType || 'BIKE',
        vehicleRegNo: nextRider?.vehicleRegNo || '',
        licenceDocUrl: nextRider?.licenceDocUrl || '',
        vehicleRcDocUrl: nextRider?.vehicleRcDocUrl || '',
      });
      setBankDraft({
        upiId: nextRider?.upiId || '',
        bankAccountRef: nextRider?.bankAccountRef || '',
      });
    } else {
      setError(errorText(riderResult.reason, 'Could not load your rider profile.'));
    }

    setActiveTrip(tripResult.status === 'fulfilled' ? tripResult.value || null : null);
    setHistory(historyResult.status === 'fulfilled' && Array.isArray(historyResult.value)
      ? historyResult.value
      : []);
    setEarnings(earningsResult.status === 'fulfilled' ? earningsResult.value : null);
    setHubs(hubsResult.status === 'fulfilled' && Array.isArray(hubsResult.value)
      ? hubsResult.value
      : []);

    setLoading(false);
  }, [riderId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live GPS pings while the rider is online on an active trip. The API only
  // accepts a ping when a trip is in flight, so an idle rider sends nothing.
  useEffect(() => {
    if (!riderId || !rider?.isOnline || !activeTrip?.id) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let lastSent = 0;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSent < 15000) return;
        lastSent = now;
        api.riders
          .pingLocation(riderId, position.coords.latitude, position.coords.longitude)
          .catch(() => null);
      },
      () => null,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [riderId, rider?.isOnline, activeTrip?.id]);

  const run = async (key: string, action: () => Promise<any>, success: string) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await load();
      setTimeout(() => setMessage(null), 4500);
    } catch (err: any) {
      setError(errorText(err, 'That action could not be completed.'));
    } finally {
      setBusy(null);
    }
  };

  const toggleOnline = async () => {
    if (!rider) return;
    await run(
      'online',
      () => api.riders.toggleOnline(rider.id, !rider.isOnline),
      rider.isOnline ? 'You are now offline.' : 'You are now online and can receive trips.',
    );
  };

  const changeHub = async (hubId: string) => {
    if (!rider || !hubId) return;
    await run('hub', () => api.riders.setHub(rider.id, hubId), 'Staging hub updated.');
  };

  const acceptTrip = async () => {
    if (!activeTrip) return;
    await run('accept', () => api.acceptTrip(activeTrip.id, riderId), 'Trip accepted.');
  };

  const rejectTrip = async () => {
    if (!activeTrip) return;
    if (!rejectReason.trim()) {
      setError('Give a short reason before rejecting the trip.');
      return;
    }
    await run(
      'reject',
      () => api.rejectTrip(activeTrip.id, riderId, rejectReason.trim()),
      'Trip released. Dispatch will reassign it.',
    );
    setShowReject(false);
    setRejectReason('');
  };

  const arriveAtHub = async () => {
    if (!activeTrip) return;
    setBusy('arrive-hub');
    setError(null);
    setMessage(null);
    try {
      let coords: { lat: number; lng: number };
      try {
        coords = await getPosition();
      } catch (locationError: any) {
        const hub = activeTrip.order?.hub;
        if (process.env.NODE_ENV !== 'production' && hub) {
          // Development machines are rarely inside the 100 m hub geofence.
          // Production always requires a real device fix.
          coords = { lat: Number(hub.lat), lng: Number(hub.lng) };
          setMessage('Using the hub coordinates because this device denied location access.');
        } else {
          throw locationError;
        }
      }
      await api.arrivedAtHub(activeTrip.id, riderId, coords.lat, coords.lng);
      setMessage('Hub arrival confirmed.');
      await load();
    } catch (err: any) {
      setError(errorText(err, 'Could not confirm arrival at the hub.'));
    } finally {
      setBusy(null);
    }
  };

  const confirmPickup = async () => {
    if (!activeTrip) return;
    await run(
      'pickup',
      () => api.confirmPickup(activeTrip.id, riderId),
      'Order collected. Ask the customer for their 4-digit delivery OTP at the door.',
    );
  };

  const arriveAtCustomer = async () => {
    if (!activeTrip) return;
    await run(
      'arrive-customer',
      () => api.arrivedAtCustomer(activeTrip.id, riderId),
      'Customer arrival confirmed.',
    );
  };

  const completeDelivery = async () => {
    if (!activeTrip) return;
    if (!/^\d{4}$/.test(deliveryOtp.trim())) {
      setError('Enter the 4-digit OTP shown in the customer app.');
      return;
    }
    await run(
      'deliver',
      () => api.verifyDeliveryOtp(activeTrip.id, riderId, deliveryOtp.trim()),
      'Delivery completed. Your earnings have been credited.',
    );
    setDeliveryOtp('');
  };

  const saveKyc = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rider) return;
    await run(
      'kyc',
      () =>
        api.riders.updateDocuments(rider.id, {
          vehicleType: kycDraft.vehicleType,
          vehicleRegNo: kycDraft.vehicleRegNo.trim() || undefined,
          licenceDocUrl: kycDraft.licenceDocUrl.trim() || undefined,
          vehicleRcDocUrl: kycDraft.vehicleRcDocUrl.trim() || undefined,
        }),
      'KYC details saved.',
    );
  };

  const saveBank = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rider) return;
    if (!bankDraft.upiId.trim() && !bankDraft.bankAccountRef.trim()) {
      setError('Add a UPI id or a bank account reference so finance can pay you.');
      return;
    }
    await run(
      'bank',
      () =>
        api.riders.updateBank(rider.id, {
          upiId: bankDraft.upiId.trim() || undefined,
          bankAccountRef: bankDraft.bankAccountRef.trim() || undefined,
        }),
      'Payout details saved.',
    );
  };

  const breakdown = useMemo(() => {
    const rows = earnings?.breakdown && typeof earnings.breakdown === 'object'
      ? Object.entries(earnings.breakdown as Record<string, number>)
      : [];
    return rows.sort((a, b) => Number(b[1]) - Number(a[1]));
  }, [earnings]);

  if (!riderId) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-center space-y-3">
        <ShieldAlert className="w-8 h-8 mx-auto text-rose-500" />
        <h1 className="text-lg font-black text-gray-900 dark:text-white">Rider sign-in required</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Sign in with the phone number registered with the fleet desk.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">
              {rider?.name || 'Rider console'}
            </h1>
            <p className="text-xs text-slate-400">
              {rider?.phone || ''} • {rider?.currentHub?.name || 'No staging hub'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
              RIDER_STATUS_STYLE[rider?.status] || RIDER_STATUS_STYLE.SUSPENDED
            }`}
          >
            {String(rider?.status || 'LOADING').replace(/_/g, ' ')}
          </span>
          <button
            onClick={toggleOnline}
            disabled={busy === 'online' || !rider || rider.status !== 'APPROVED'}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50 ${
              rider?.isOnline
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
            title={
              rider?.status !== 'APPROVED'
                ? 'KYC approval is required before going online'
                : 'Toggle availability'
            }
          >
            {busy === 'online' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Power className="w-3.5 h-3.5" />
            )}
            {rider?.isOnline ? 'Online' : 'Offline'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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

      {rider?.status === 'PENDING_APPROVAL' && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-sm flex items-start gap-2">
          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold">Your KYC is waiting for operations approval.</div>
            <p className="text-xs mt-0.5">
              Complete the documents in the Profile tab. You can go online once an ops admin
              approves the account.
            </p>
          </div>
        </div>
      )}

      {rider?.status === 'REJECTED' || rider?.status === 'SUSPENDED' ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold">
              This rider account is {String(rider.status).toLowerCase()}.
            </div>
            <p className="text-xs mt-0.5">
              Contact the fleet desk. You cannot receive trips until the account is approved
              again.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {(
              [
                { id: 'delivery', label: 'Active delivery', icon: <Truck className="w-4 h-4" /> },
                { id: 'history', label: 'Trip history', icon: <Route className="w-4 h-4" /> },
                { id: 'earnings', label: 'Earnings', icon: <Wallet className="w-4 h-4" /> },
                { id: 'profile', label: 'Profile & KYC', icon: <UserRound className="w-4 h-4" /> },
              ] as { id: Tab; label: string; icon: React.ReactNode }[]
            ).map((candidate) => (
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

          {loading ? (
            <div className="p-12 text-center text-sm text-gray-400">Loading your console…</div>
          ) : (
            <>
              {tab === 'delivery' && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                  {activeTrip ? (
                    <div className="p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                            Trip {shortId(activeTrip.id)} • Order {shortId(activeTrip.orderId)}
                          </div>
                          <div className="text-lg font-black text-gray-900 dark:text-white">
                            {TRIP_LABEL[activeTrip.status] || activeTrip.status}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                            TRIP_STYLE[activeTrip.status] || TRIP_STYLE.ASSIGNED
                          }`}
                        >
                          {String(activeTrip.status).replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/60">
                          <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                            <PackageCheck className="w-3.5 h-3.5" /> Pickup
                          </div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white mt-1">
                            {activeTrip.order?.hub?.name || 'Hub'}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-slate-400">
                            {activeTrip.order?.hub?.city || ''}
                          </div>
                        </div>
                        <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/60">
                          <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> Drop
                          </div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white mt-1">
                            {activeTrip.order?.address?.label || 'Customer address'}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-slate-400">
                            {[
                              activeTrip.order?.address?.addressLine,
                              activeTrip.order?.address?.landmark,
                              activeTrip.order?.address?.city,
                              activeTrip.order?.address?.pincode,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                          {activeTrip.order?.address?.lat && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${activeTrip.order.address.lat},${activeTrip.order.address.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-[10px] font-extrabold text-blue-600 dark:text-blue-400"
                            >
                              <Navigation className="w-3 h-3" /> Open in Maps
                            </a>
                          )}
                        </div>
                      </div>

                      {activeTrip.order?.user?.phone && (
                        <a
                          href={`tel:${activeTrip.order.user.phone}`}
                          className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
                        >
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                              Customer
                            </div>
                            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                              {activeTrip.order.user.name || 'Customer'} •{' '}
                              {activeTrip.order.user.phone}
                            </div>
                          </div>
                          <Phone className="w-4 h-4 text-emerald-600" />
                        </a>
                      )}

                      {Array.isArray(activeTrip.order?.brandOrders) &&
                        activeTrip.order.brandOrders.length > 0 && (
                          <div className="rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                            <div className="px-3 py-2 bg-gray-50 dark:bg-slate-800/60 text-[10px] font-black uppercase tracking-wider text-gray-400">
                              Order contents
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-slate-800">
                              {activeTrip.order.brandOrders.flatMap((brandOrder: any) =>
                                (brandOrder.items || []).map((item: any) => (
                                  <div
                                    key={item.id}
                                    className="px-3 py-2 flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <span className="font-bold text-gray-900 dark:text-white">
                                        {item.nameSnapshot}
                                      </span>
                                      <span className="text-[10px] text-gray-400">
                                        {' '}
                                        • {brandOrder.status?.replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                    <span className="font-black text-gray-500 dark:text-slate-400">
                                      ×{item.quantity}
                                    </span>
                                  </div>
                                )),
                              )}
                            </div>
                          </div>
                        )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {activeTrip.status === 'ASSIGNED' && (
                          <>
                            <button
                              onClick={acceptTrip}
                              disabled={busy === 'accept'}
                              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {busy === 'accept' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              Accept trip
                            </button>
                            <button
                              onClick={() => setShowReject((current) => !current)}
                              className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-xs font-extrabold"
                            >
                              Can't take it
                            </button>
                          </>
                        )}

                        {activeTrip.status === 'ACCEPTED' && (
                          <button
                            onClick={arriveAtHub}
                            disabled={busy === 'arrive-hub'}
                            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {busy === 'arrive-hub' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5" />
                            )}
                            I'm at the hub
                          </button>
                        )}

                        {activeTrip.status === 'ARRIVED_AT_HUB' && (
                          <button
                            onClick={confirmPickup}
                            disabled={busy === 'pickup'}
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {busy === 'pickup' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <PackageCheck className="w-3.5 h-3.5" />
                            )}
                            Collect order
                          </button>
                        )}

                        {activeTrip.status === 'PICKED_UP' && (
                          <button
                            onClick={arriveAtCustomer}
                            disabled={busy === 'arrive-customer'}
                            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {busy === 'arrive-customer' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5" />
                            )}
                            I'm at the customer
                          </button>
                        )}

                        {activeTrip.status === 'ARRIVING' && (
                          <div className="w-full space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                              Customer delivery OTP
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                value={deliveryOtp}
                                onChange={(event) =>
                                  setDeliveryOtp(
                                    event.target.value.replace(/\D/g, '').slice(0, 4),
                                  )
                                }
                                inputMode="numeric"
                                placeholder="4-digit code"
                                className="flex-1 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-black tracking-[0.4em] text-center text-gray-900 dark:text-white"
                              />
                              <button
                                onClick={completeDelivery}
                                disabled={busy === 'deliver'}
                                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50"
                              >
                                {busy === 'deliver' ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                Complete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {showReject && activeTrip.status === 'ASSIGNED' && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            value={rejectReason}
                            onChange={(event) => setRejectReason(event.target.value)}
                            placeholder="Reason (flat tyre, too far…)"
                            className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                          />
                          <button
                            onClick={rejectTrip}
                            disabled={busy === 'reject'}
                            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold disabled:opacity-50"
                          >
                            Release
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-12 text-center space-y-3">
                      <Truck className="w-10 h-10 mx-auto text-gray-300 dark:text-slate-600" />
                      <div className="text-sm font-extrabold text-gray-900 dark:text-white">
                        No active delivery
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
                        {rider?.isOnline
                          ? 'You are online. Dispatch will assign the next order for your staging hub.'
                          : 'Go online to receive deliveries.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {tab === 'history' && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-slate-800 text-sm font-extrabold text-gray-900 dark:text-white">
                    Last {history.length} trips
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[620px] overflow-y-auto">
                    {history.map((trip) => (
                      <div key={trip.id} className="p-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-gray-900 dark:text-white truncate">
                            {trip.order?.hub?.name || 'Hub'} →{' '}
                            {trip.order?.address?.label || 'Customer'}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">
                            {trip.order?.address?.addressLine || ''}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {new Date(trip.createdAt).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-black ${
                            TRIP_STYLE[trip.status] || TRIP_STYLE.CANCELLED
                          }`}
                        >
                          {String(trip.status).replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <div className="p-10 text-center text-xs text-gray-400">
                        No trips yet. Your completed deliveries will appear here.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'earnings' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
                      <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        Total earned
                      </div>
                      <div className="text-xl font-black text-emerald-600">
                        {rupees(earnings?.totalPaise)}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
                      <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        Entries
                      </div>
                      <div className="text-xl font-black text-gray-900 dark:text-white">
                        {Array.isArray(earnings?.earnings) ? earnings.earnings.length : 0}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
                      <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        Payout method
                      </div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {rider?.upiId || rider?.bankAccountRef || 'Not set'}
                      </div>
                    </div>
                  </div>

                  {breakdown.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5">
                      <div className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                        <BadgeIndianRupee className="w-4 h-4 text-emerald-500" />
                        Breakdown
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {breakdown.map(([type, amount]) => (
                          <span
                            key={type}
                            className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-[10px] font-bold text-gray-600 dark:text-slate-300"
                          >
                            {type.replace(/_/g, ' ')}: {rupees(Number(amount))}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 dark:border-slate-800 text-sm font-extrabold text-gray-900 dark:text-white">
                      Earnings ledger
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[520px] overflow-y-auto">
                      {(earnings?.earnings || []).map((entry: any) => (
                        <div
                          key={entry.id}
                          className="p-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white">
                              {String(entry.type).replace(/_/g, ' ')}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {new Date(entry.createdAt).toLocaleString('en-IN')}
                              {entry.tripId ? ` • trip ${shortId(entry.tripId)}` : ''}
                            </div>
                          </div>
                          <span
                            className={`font-black ${
                              entry.amountInPaise >= 0 ? 'text-emerald-600' : 'text-rose-500'
                            }`}
                          >
                            {entry.amountInPaise >= 0 ? '+' : '−'}
                            {rupees(Math.abs(entry.amountInPaise))}
                          </span>
                        </div>
                      ))}
                      {(earnings?.earnings || []).length === 0 && (
                        <div className="p-10 text-center text-xs text-gray-400">
                          No earnings recorded yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'profile' && (
                <div className="space-y-4">
                  <form
                    onSubmit={saveKyc}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5 space-y-3"
                  >
                    <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-blue-500" />
                      Vehicle & KYC documents
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                          Vehicle type
                        </span>
                        <select
                          value={kycDraft.vehicleType}
                          onChange={(event) =>
                            setKycDraft({ ...kycDraft, vehicleType: event.target.value })
                          }
                          className={inputClass}
                        >
                          <option value="BIKE">Bike</option>
                          <option value="SCOOTER">Scooter</option>
                          <option value="BICYCLE">Bicycle</option>
                          <option value="EV">Electric vehicle</option>
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                          Registration number
                        </span>
                        <input
                          value={kycDraft.vehicleRegNo}
                          onChange={(event) =>
                            setKycDraft({ ...kycDraft, vehicleRegNo: event.target.value })
                          }
                          placeholder="KA 01 AB 1234"
                          className={inputClass}
                        />
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        Driving licence document URL
                      </span>
                      <input
                        value={kycDraft.licenceDocUrl}
                        onChange={(event) =>
                          setKycDraft({ ...kycDraft, licenceDocUrl: event.target.value })
                        }
                        placeholder="https://…"
                        className={inputClass}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        Vehicle RC document URL
                      </span>
                      <input
                        value={kycDraft.vehicleRcDocUrl}
                        onChange={(event) =>
                          setKycDraft({ ...kycDraft, vehicleRcDocUrl: event.target.value })
                        }
                        placeholder="https://…"
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={busy === 'kyc'}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold disabled:opacity-50"
                    >
                      {busy === 'kyc' ? 'Saving…' : 'Save KYC details'}
                    </button>
                  </form>

                  <form
                    onSubmit={saveBank}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5 space-y-3"
                  >
                    <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-500" />
                      Payout details
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                          UPI id
                        </span>
                        <input
                          value={bankDraft.upiId}
                          onChange={(event) =>
                            setBankDraft({ ...bankDraft, upiId: event.target.value })
                          }
                          placeholder="name@upi"
                          className={inputClass}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                          Bank account reference
                        </span>
                        <input
                          value={bankDraft.bankAccountRef}
                          onChange={(event) =>
                            setBankDraft({ ...bankDraft, bankAccountRef: event.target.value })
                          }
                          placeholder="HDFC •••• 4321"
                          className={inputClass}
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={busy === 'bank'}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold disabled:opacity-50"
                    >
                      {busy === 'bank' ? 'Saving…' : 'Save payout details'}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5 space-y-3">
            <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <Bike className="w-4 h-4 text-rose-500" />
              Staging hub
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              Dispatch only assigns orders from the hub you are staged at.
            </p>
            <select
              value={rider?.currentHubId || ''}
              onChange={(event) => changeHub(event.target.value)}
              disabled={busy === 'hub'}
              className={inputClass}
            >
              <option value="">Select a hub…</option>
              {hubs.map((hub) => (
                <option key={hub.id} value={hub.id}>
                  {hub.name} • {hub.city}
                </option>
              ))}
            </select>
            {!rider?.currentHubId && (
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                Pick a hub before going online.
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5 space-y-2">
            <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <UserRound className="w-4 h-4 text-purple-500" />
              Rider profile
            </h2>
            <Row label="Phone" value={rider?.phone || '—'} />
            <Row label="Vehicle" value={rider?.vehicleType || '—'} />
            <Row label="Registration" value={rider?.vehicleRegNo || 'Not set'} />
            <Row
              label="Capacity"
              value={rider?.capacityMax ? `${rider.capacityMax} order(s)` : '—'}
            />
            <Row
              label="Approved"
              value={rider?.approvedAt ? new Date(rider.approvedAt).toLocaleDateString('en-IN') : '—'}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white';

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 text-xs">
    <span className="text-gray-400 font-bold">{label}</span>
    <span className="font-extrabold text-gray-900 dark:text-white truncate">{value}</span>
  </div>
);
