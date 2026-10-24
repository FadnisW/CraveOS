'use client';

import React, { useEffect, useState } from 'react';
import {
  Bike,
  Clock,
  ArrowLeft,
  UserCheck,
  RefreshCw,
  CheckCircle,
  Navigation,
  AlertCircle,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api-client';

interface AdminDispatchViewProps {
  onBackToStorefront: () => void;
}

export const AdminDispatchView: React.FC<AdminDispatchViewProps> = ({ onBackToStorefront }) => {
  const [riders, setRiders] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [otpInput, setOtpInput] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchDispatchData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ridersData, tripsData] = await Promise.all([
        api.riders.getAll(),
        api.getActiveTrips(),
      ]);
      setRiders(Array.isArray(ridersData) ? ridersData : []);
      setTrips(Array.isArray(tripsData) ? tripsData : []);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load dispatch data.');
      setRiders([]);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatchData();
  }, []);

  const handleTripAction = async (
    action: string,
    trip: any,
    extra?: { otp?: string; reason?: string },
  ) => {
    try {
      setActionMsg(null);
      const tripId = trip.id;
      const riderId = trip.riderId;

      if (action === 'auto-assign') {
        const result = await api.autoAssignRider(trip.orderId);
        setActionMsg(
          result?.trip
            ? `Rider ${result.trip.rider?.name || result.trip.riderId} assigned to Trip #${tripId.slice(0, 8)}`
            : `No approved rider is currently available for Trip #${tripId.slice(0, 8)}.`,
        );
      } else if (action === 'cancel') {
        const reason = extra?.reason || 'Cancelled by dispatch';
        await api.cancelTrip(tripId, reason);
        setActionMsg(`Trip #${tripId.slice(0, 8)} cancelled.`);
      } else if (action === 'accept' && riderId) {
        await api.acceptTrip(tripId, riderId);
        setActionMsg(`Trip #${tripId.slice(0, 8)} accepted by rider.`);
      } else if (action === 'arrived-hub' && riderId) {
        await api.arrivedAtHub(
          tripId,
          riderId,
          trip.rider?.liveLat ?? trip.order?.hub?.lat ?? 12.9716,
          trip.rider?.liveLng ?? trip.order?.hub?.lng ?? 77.5946,
        );
        setActionMsg(`Rider arrived at hub for Trip #${tripId.slice(0, 8)}.`);
      } else if (action === 'pickup' && riderId) {
        const res = await api.confirmPickup(tripId, riderId);
        setActionMsg(
          `Pickup confirmed! Delivery OTP: ${res?.deliveryOtp || res?.otp || '****'}`,
        );
      } else if (action === 'arrived-customer' && riderId) {
        await api.arrivedAtCustomer(tripId, riderId);
        setActionMsg(`Rider arrived at the customer for Trip #${tripId.slice(0, 8)}.`);
      } else if (action === 'deliver' && riderId) {
        const otp = extra?.otp || otpInput[tripId];
        if (!otp) {
          setActionMsg('Enter the customer delivery OTP first.');
          return;
        }
        await api.verifyDeliveryOtp(tripId, riderId, otp);
        setActionMsg('Order delivered successfully — OTP verified.');
      } else if (action === 'reject' && riderId) {
        const reason = extra?.reason || 'Rider rejected the trip';
        await api.rejectTrip(tripId, riderId, reason);
        setActionMsg(`Trip #${tripId.slice(0, 8)} rejected and re-queued.`);
      }

      await fetchDispatchData();
      setTimeout(() => setActionMsg(null), 5000);
    } catch (err: any) {
      setActionMsg(null);
      setLoadError(err?.message || `Failed to execute ${action}`);
    }
  };

  const promptAndRun = (action: string, trip: any, promptText: string) => {
    const reason = typeof window !== 'undefined' ? window.prompt(promptText) : null;
    if (reason === null) return;
    handleTripAction(action, trip, { reason: reason.trim() || undefined });
  };

  const onlineRiders = riders.filter((r) => r.isOnline);
  const activeTripsCount = trips.length;
  const unassignedCount = trips.filter((t) => t.status === 'UNASSIGNED').length;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-md">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold">Rider Dispatch & Logistics Console</h1>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                LIVE HUB FLEET
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Hyperlocal fleet assignment, delivery trip state machine & live tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchDispatchData}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onBackToStorefront}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Storefront</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {loadError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Fleet Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Online Fleet</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {onlineRiders.length} / {riders.length} Riders
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Active Delivery Trips</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {activeTripsCount} Active Trips
            </div>
            {unassignedCount > 0 && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {unassignedCount} awaiting a rider
              </span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Delivery SLA Target</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white">&lt; 25 Mins</div>
          </div>
        </div>
      </div>

      {/* Active Trips Dispatch Control Console */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 space-y-4">
        <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
          <Navigation className="w-5 h-5 text-rose-500" />
          Live Delivery Trip State Machine ({trips.length})
        </h3>

        {trips.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No active trips currently in progress. Place an order to trigger rider dispatch!
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {trips.map((t) => (
              <div
                key={t.id}
                className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                      Trip #{t.id.slice(0, 8)}
                    </span>
                    <span className="text-xs bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-2.5 py-0.5 rounded-full font-bold">
                      {t.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Order #{t.orderId?.slice(0, 8)} • Rider:{' '}
                    <strong className="text-gray-800 dark:text-slate-200">
                      {t.rider?.name || 'Unassigned'}
                    </strong>
                    {t.order?.user?.name && <> • {t.order.user.name}</>}
                  </div>
                  {t.order?.address?.addressLine && (
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {t.order.address.addressLine}
                    </div>
                  )}
                  {t.deliveryOtp && (
                    <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      Customer Delivery OTP: {t.deliveryOtp}
                    </div>
                  )}
                </div>

                {/* State Machine Action Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {t.status === 'UNASSIGNED' && (
                    <button
                      onClick={() => handleTripAction('auto-assign', t)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Auto-Assign Rider
                    </button>
                  )}

                  {t.status === 'ASSIGNED' && t.riderId && (
                    <button
                      onClick={() => handleTripAction('accept', t)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                    >
                      Rider Accept
                    </button>
                  )}

                  {t.status === 'ACCEPTED' && t.riderId && (
                    <button
                      onClick={() => handleTripAction('arrived-hub', t)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                    >
                      Arrive at Hub
                    </button>
                  )}

                  {t.status === 'ARRIVED_AT_HUB' && t.riderId && (
                    <button
                      onClick={() => handleTripAction('pickup', t)}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                    >
                      Confirm Pickup (Generate OTP)
                    </button>
                  )}

                  {t.status === 'PICKED_UP' && t.riderId && (
                    <button
                      onClick={() => handleTripAction('arrived-customer', t)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                    >
                      Arrive at Customer
                    </button>
                  )}

                  {t.status === 'ARRIVING' && t.riderId && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="4-digit OTP"
                        maxLength={4}
                        value={otpInput[t.id] || ''}
                        onChange={(e) => setOtpInput({ ...otpInput, [t.id]: e.target.value })}
                        className="bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl px-2 py-1 text-xs w-24 text-center font-mono font-bold"
                      />
                      <button
                        onClick={() => handleTripAction('deliver', t)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                      >
                        Verify & Deliver
                      </button>
                    </div>
                  )}

                  {t.status === 'ASSIGNED' && t.riderId && (
                    <button
                      onClick={() =>
                        promptAndRun('reject', t, 'Reason for rejecting this trip?')
                      }
                      className="bg-gray-100 hover:bg-rose-50 text-gray-500 hover:text-rose-600 text-xs font-bold px-2.5 py-1.5 rounded-xl"
                      title="Reject and re-queue the trip"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}

                  {['UNASSIGNED', 'ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_HUB'].includes(t.status) && (
                    <button
                      onClick={() =>
                        promptAndRun('cancel', t, 'Reason for cancelling this trip?')
                      }
                      className="text-[11px] font-bold text-gray-400 hover:text-rose-600 px-2 py-1.5"
                    >
                      Cancel trip
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fleet Roster List */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 space-y-4">
        <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
          Hub Delivery Fleet Roster ({riders.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {riders.map((rider) => (
            <div
              key={rider.id}
              className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200/80 dark:border-slate-700 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-extrabold text-sm text-slate-800 dark:text-white">
                  {(rider.name || 'R').charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">
                    {rider.name}
                  </h4>
                  <p className="text-[10px] text-gray-400">
                    {rider.phone} • {rider.rating || 5.0} ★
                  </p>
                </div>
              </div>

              <div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                    rider.isOnline
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}
                >
                  {rider.isOnline ? '🟢 ONLINE STAGED' : '⚪ OFFLINE'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
