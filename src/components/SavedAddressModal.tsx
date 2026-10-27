'use client';

import React, { useEffect, useState } from 'react';
import { SavedAddress } from '../types';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { api } from '../lib/api-client';
import {
  X,
  MapPin,
  Check,
  Plus,
  Home,
  Briefcase,
  Building,
  AlertTriangle,
  Trash2,
  ArrowLeft,
  Loader2,
  Crosshair,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmDialog } from './ui/Dialog';

interface SavedAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAddressId: string;
  onSelectAddress: (address: SavedAddress) => void;
}

type AddressType = 'home' | 'work' | 'other';

interface AddressFormState {
  type: AddressType;
  label: string;
  addressLine: string;
  landmark: string;
  city: string;
  pincode: string;
}

const EMPTY_FORM: AddressFormState = {
  type: 'home',
  label: 'Home',
  addressLine: '',
  landmark: '',
  city: 'Bengaluru',
  pincode: '',
};

function normaliseAddress(raw: any): SavedAddress {
  const type = String(raw?.type || 'home').toLowerCase();

  return {
    id: raw?.id || '',
    type: type === 'work' ? 'work' : type === 'other' ? 'other' : 'home',
    label: raw?.label || '',
    addressLine: raw?.addressLine || '',
    landmark: raw?.landmark || undefined,
    city: raw?.city || '',
    pincode: raw?.pincode || '',
    lat: Number(raw?.lat),
    lng: Number(raw?.lng),
    resolvedHubId: raw?.resolvedHubId || '',
    isDefault: !!raw?.isDefault,
  };
}

export const SavedAddressModal: React.FC<SavedAddressModalProps> = ({
  isOpen,
  onClose,
  selectedAddressId,
  onSelectAddress,
}) => {
  const { user, isAuthenticated } = useUser();
  const { pinnedHubId, setPinnedHubId, cartItems, clearCart } = useCart();

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAddress, setPendingAddress] = useState<{
    address: SavedAddress;
    resolvedHubId: string;
  } | null>(null);

  const [showForm, setShowForm] = useState<boolean>(false);
  const [form, setForm] = useState<AddressFormState>(EMPTY_FORM);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedAddress | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Load the real address book whenever the modal opens. Signed-out visitors
  // have no address book: an address can only be saved to an account.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setError(null);
    setShowForm(false);
    setForm(EMPTY_FORM);
    setCoords(null);

    if (!isAuthenticated) {
      setAddresses([]);
      return;
    }

    // The login payload already contains the database addresses; show those
    // immediately, then refresh from the API.
    if (user?.savedAddresses?.length) {
      setAddresses(user.savedAddresses);
    }

    setLoading(true);
    api.addresses
      .list()
      .then((result) => {
        if (cancelled) return;
        const list = (Array.isArray(result) ? result : [])
          .map(normaliseAddress)
          .filter(
            (address: SavedAddress) =>
              !!address.id &&
              !!address.addressLine &&
              Number.isFinite(address.lat) &&
              Number.isFinite(address.lng),
          );
        setAddresses(list);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Failed to load your saved addresses.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, isAuthenticated, user?.savedAddresses]);

  const handleSelect = async (addr: SavedAddress) => {
    let resolvedHub = addr.resolvedHubId;

    if (!resolvedHub && addr.lat && addr.lng) {
      try {
        const serviceability = await api.resolveServiceability(addr.lat, addr.lng);
        if (serviceability?.hubId) resolvedHub = serviceability.hubId;
      } catch {
        // Fall through to the clear error below.
      }
    }

    if (!resolvedHub) {
      setError('This address is outside our delivery area. Please add another address.');
      return;
    }

    if (cartItems.length > 0 && pinnedHubId && resolvedHub !== pinnedHubId) {
      setPendingAddress({ address: addr, resolvedHubId: resolvedHub });
      return;
    }

    setPinnedHubId(resolvedHub);
    onSelectAddress(addr);
    onClose();
  };

  const confirmSwitchAddressAndClearCart = () => {
    if (!pendingAddress) return;
    clearCart();
    setPinnedHubId(pendingAddress.resolvedHubId);
    onSelectAddress(pendingAddress.address);
    setPendingAddress(null);
    onClose();
  };

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location access is not available in this browser.');
      return;
    }

    setLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setError('Could not read your location. Allow location access and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const handleCreateAddress = async () => {
    if (!isAuthenticated) {
      setError('Sign in first so the address can be saved to your account.');
      return;
    }

    if (form.addressLine.trim().length < 5) {
      setError('Enter a full street address (at least 5 characters).');
      return;
    }

    if (!coords) {
      setError('Tap “Use my current location” so we can verify delivery to this address.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await api.addresses.create({
        type: form.type,
        label: form.label.trim() || (form.type === 'home' ? 'Home' : form.type === 'work' ? 'Work' : 'Other'),
        addressLine: form.addressLine.trim(),
        landmark: form.landmark.trim() || undefined,
        city: form.city.trim() || 'Bengaluru',
        pincode: form.pincode.trim() || undefined,
        lat: coords.lat,
        lng: coords.lng,
        isDefault: addresses.length === 0,
      });

      const createdAddress = normaliseAddress(created);
      setAddresses((prev) => [createdAddress, ...prev.filter((a) => a.id !== createdAddress.id)]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setCoords(null);
      await handleSelect(createdAddress);
    } catch (err: any) {
      setError(err?.message || 'Failed to save this address.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (address: SavedAddress) => {
    if (!isAuthenticated) return;
    setDeleteTarget(address);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setError(null);
    setDeleting(true);
    try {
      await api.addresses.remove(deleteTarget.id);
      setAddresses((prev) => prev.filter((candidate) => candidate.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete this address.');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                Choose Delivery Address
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {pendingAddress ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">
                    Clear Cart to Switch Hub?
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Different Cloud Kitchen Location
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <p>
                  Your cart currently has <strong>{cartItems.length} item(s)</strong> pinned to{' '}
                  <strong className="underline">{pinnedHubId}</strong>.
                </p>
                <p>
                  <strong>{pendingAddress.address.label}</strong> is serviced by{' '}
                  <strong className="underline">{pendingAddress.resolvedHubId}</strong>. Changing to
                  this address requires clearing your current cart items so everything can be freshly
                  prepared at the new hub.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPendingAddress(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 text-gray-700 dark:text-slate-200 font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Keep Current</span>
                </button>

                <button
                  onClick={confirmSwitchAddressAndClearCart}
                  className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/30 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear &amp; Switch</span>
                </button>
              </div>
            </div>
          ) : showForm ? (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-900 dark:text-white">Add a new address</h3>

              <div className="grid grid-cols-3 gap-2">
                {(['home', 'work', 'other'] as AddressType[]).map((type) => {
                  const Icon = type === 'home' ? Home : type === 'work' ? Briefcase : Building;
                  const active = form.type === type;
                  return (
                    <button
                      key={type}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          type,
                          label:
                            prev.label === 'Home' || prev.label === 'Work' || prev.label === 'Other'
                              ? type === 'home'
                                ? 'Home'
                                : type === 'work'
                                  ? 'Work'
                                  : 'Other'
                              : prev.label,
                        }))
                      }
                      className={`py-2 rounded-xl border text-[11px] font-extrabold capitalize flex items-center justify-center gap-1.5 ${
                        active
                          ? 'border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {type}
                    </button>
                  );
                })}
              </div>

              <input
                value={form.label}
                onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                placeholder="Label (e.g. Home, Office)"
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
              />

              <textarea
                value={form.addressLine}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, addressLine: event.target.value }))
                }
                placeholder="Flat / building, street, area"
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white resize-none"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.landmark}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, landmark: event.target.value }))
                  }
                  placeholder="Landmark (optional)"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                />
                <input
                  value={form.pincode}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, pincode: event.target.value }))
                  }
                  placeholder="Pincode"
                  inputMode="numeric"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                />
              </div>

              <button
                onClick={handleUseCurrentLocation}
                disabled={locating}
                className={`w-full py-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 ${
                  coords
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                    : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200'
                }`}
              >
                {locating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Crosshair className="w-4 h-4" />
                )}
                {coords
                  ? `Location verified (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
                  : 'Use my current location'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setError(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-extrabold text-gray-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAddress}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Address
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {loading && addresses.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading your addresses…
                  </div>
                ) : addresses.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500 dark:text-slate-400">
                    {isAuthenticated
                      ? 'No saved addresses yet. Add one to start ordering.'
                      : 'Sign in to see your saved addresses.'}
                  </div>
                ) : (
                  addresses.map((addr) => {
                    const isSelected = addr.id === selectedAddressId;
                    const Icon =
                      addr.type === 'home' ? Home : addr.type === 'work' ? Briefcase : Building;

                    return (
                      <div
                        key={addr.id}
                        onClick={() => handleSelect(addr)}
                        className={`p-4 rounded-2xl border cursor-pointer flex items-start justify-between gap-3 transition-all ${
                          isSelected
                            ? 'border-rose-600 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                            : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isSelected
                                ? 'bg-rose-600 text-white'
                                : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase text-gray-900 dark:text-white">
                              {addr.label}
                              {addr.isDefault && (
                                <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                  DEFAULT
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">
                              {addr.addressLine}
                            </p>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              {addr.resolvedHubId
                                ? `Served by ${addr.resolvedHubId}`
                                : 'Hub pending'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isSelected && <Check className="w-5 h-5 text-rose-600" />}
                          {isAuthenticated && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(addr);
                              }}
                              className="p-1 rounded-lg text-gray-400 hover:text-rose-600"
                              title="Delete address"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    setError('Sign in first so the address can be saved to your account.');
                    return;
                  }
                  setShowForm(true);
                  setError(null);
                }}
                className="w-full py-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white font-extrabold text-xs hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add New Address
              </button>

              {!isAuthenticated && (
                <p className="text-[10px] text-center text-gray-400">
                  Sign in to save addresses and place orders.
                </p>
              )}
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>

    <ConfirmDialog
      open={!!deleteTarget}
      title="Delete this address?"
      description={
        deleteTarget
          ? `“${deleteTarget.label}” will be removed from your saved addresses.`
          : undefined
      }
      confirmLabel="Delete address"
      tone="danger"
      busy={deleting}
      onConfirm={confirmDelete}
      onClose={() => {
        if (!deleting) setDeleteTarget(null);
      }}
    />
    </>
  );
};
