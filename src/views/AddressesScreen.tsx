'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api-client';
import { useUser } from '../context/UserContext';
import { useShop } from '../context/ShopContext';
import { useApi } from '../hooks/useApi';
import { AddressMap } from '../components/AddressMap';
import { ConfirmDialog } from '../components/ui/Dialog';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback';
import type { SavedAddress } from '../types';
import {
  ArrowLeft,
  Building,
  Check,
  Home,
  KeyRound,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';

type AddressType = 'home' | 'work' | 'other';

interface Draft {
  id?: string;
  type: AddressType;
  label: string;
  addressLine: string;
  landmark: string;
  pincode: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  /** A hub coordinate may centre the map, but only a customer move is a pin. */
  pinConfirmed: boolean;
}

interface HubLocation {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
}

function emptyDraft(center: { lat: number; lng: number }): Draft {
  return {
    type: 'home',
    label: 'Home',
    addressLine: '',
    landmark: '',
    pincode: '',
    lat: center.lat,
    lng: center.lng,
    isDefault: false,
    pinConfirmed: false,
  };
}

const TYPE_ICON: Record<AddressType, React.ElementType> = {
  home: Home,
  work: Building,
  other: MapPin,
};

function toDraft(address: SavedAddress): Draft {
  return {
    id: address.id,
    type: address.type,
    label: address.label,
    addressLine: address.addressLine,
    landmark: address.landmark || '',
    pincode: address.pincode,
    lat: address.lat,
    lng: address.lng,
    isDefault: address.isDefault === true,
    pinConfirmed: true,
  };
}

export const AddressesScreen: React.FC = () => {
  const router = useRouter();
  const { user, isAuthenticated, isMounted, refreshUser } = useUser();
  const { activeAddress, openAuthModal } = useShop();

  const addresses = useApi<SavedAddress[]>(() => api.addresses.list(), [user?.id], !!user?.id);
  const hubs = useApi<HubLocation[]>(() => api.getHubs(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [defaultBusyId, setDefaultBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (isMounted && !isAuthenticated) {
      setDraft(null);
    }
  }, [isMounted, isAuthenticated]);

  const reloadUser = async () => {
    const me = await api.getMe();
    refreshUser(me.user);
  };

  const openCreate = () => {
    setSaveError(null);

    // Start at a real place the customer knows: their current address, or the
    // kitchen that serves the area. The pin is not confirmed until they move
    // it, so a hub coordinate can never be saved as their door by accident.
    const center = activeAddress
      ? { lat: activeAddress.lat, lng: activeAddress.lng }
      : hubs.data?.[0]
        ? { lat: hubs.data[0].lat, lng: hubs.data[0].lng }
        : null;

    if (!center) {
      setSaveError(
        'The map is still loading. Try again in a moment, or use your current location.',
      );
      return;
    }

    setDraft(emptyDraft(center));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;

    if (!draft.pinConfirmed) {
      setSaveError(
        'Drag the map so the pin sits exactly on your door, then save.',
      );
      return;
    }
    if (draft.addressLine.trim().length < 5) {
      setSaveError('Enter the full street address, including building and street.');
      return;
    }
    if (!/^\d{6}$/.test(draft.pincode.trim())) {
      setSaveError('Enter the 6-digit pincode for this address.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload = {
      type: draft.type,
      label: draft.label.trim() || 'Home',
      addressLine: draft.addressLine.trim(),
      landmark: draft.landmark.trim() || undefined,
      pincode: draft.pincode.trim(),
      lat: draft.lat,
      lng: draft.lng,
      isDefault: draft.isDefault,
    };

    try {
      if (draft.id) {
        await api.addresses.update(draft.id, payload);
      } else {
        await api.addresses.create(payload);
      }
      await reloadUser();
      await addresses.reload();
      setDraft(null);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save this address.');
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (address: SavedAddress) => {
    setDefaultBusyId(address.id);
    setDeleteError(null);
    try {
      await api.addresses.update(address.id, { isDefault: true });
      await reloadUser();
      await addresses.reload();
    } catch (err: any) {
      setDeleteError(err?.message || 'Could not update the default address.');
    } finally {
      setDefaultBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);

    try {
      await api.addresses.remove(deleting.id);
      await reloadUser();
      await addresses.reload();
      setDeleting(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'Could not delete this address.');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!isMounted) {
    return <LoadingState label="Loading your addresses…" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
          <KeyRound className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Sign in to manage addresses</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Delivery addresses are stored on your account so checkout always uses a
          real, serviceable location.
        </p>
        <button
          onClick={openAuthModal}
          className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold"
        >
          Sign in with OTP
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => router.push('/account')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to account
        </button>
        {!draft && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold"
          >
            <Plus className="w-4 h-4" />
            Add address
          </button>
        )}
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Delivery addresses</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          The pin decides which kitchen serves you. We check it against each hub&apos;s
          real delivery polygon before saving.
        </p>
      </header>

      {draft && (
        <form
          onSubmit={save}
          className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black text-gray-900 dark:text-white">
              {draft.id ? 'Edit address' : 'New address'}
            </h2>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="text-[11px] font-bold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['home', 'work', 'other'] as const).map((type) => {
              const Icon = TYPE_ICON[type];
              const active = draft.type === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            type,
                            label:
                              current.label === 'Home' ||
                              current.label === 'Work' ||
                              current.label === 'Other'
                                ? type.charAt(0).toUpperCase() + type.slice(1)
                                : current.label,
                          }
                        : current,
                    )
                  }
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-extrabold capitalize ${
                    active
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                      : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {type}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                Label
              </span>
              <input
                value={draft.label}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, label: event.target.value } : current,
                  )
                }
                placeholder="Home, Work, Hostel…"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                Full address
              </span>
              <textarea
                required
                rows={2}
                value={draft.addressLine}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, addressLine: event.target.value } : current,
                  )
                }
                placeholder="Flat / building, street, area"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:border-rose-500"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                Landmark (optional)
              </span>
              <input
                value={draft.landmark}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, landmark: event.target.value } : current,
                  )
                }
                placeholder="Near…"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                6-digit pincode
              </span>
              <input
                required
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={draft.pincode}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          pincode: event.target.value.replace(/\D/g, '').slice(0, 6),
                        }
                      : current,
                  )
                }
                placeholder="560102"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
              Pin the delivery point
            </span>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              {draft.pinConfirmed
                ? 'Pin placed. Drag the map again if it needs adjusting.'
                : 'The map starts near the kitchen for this area. Drag the pin to your door, or use your current location.'}
            </p>
            <AddressMap
              lat={draft.lat}
              lng={draft.lng}
              onChange={(lat, lng) =>
                setDraft((current) =>
                  current
                    ? { ...current, lat, lng, pinConfirmed: true }
                    : current,
                )
              }
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, isDefault: event.target.checked } : current,
                )
              }
              className="h-4 w-4 rounded border-gray-300 text-rose-600"
            />
            Use this address by default
          </label>

          {saveError && (
            <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300">
              {saveError}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Save address'}
          </button>
        </form>
      )}

      {deleteError && (
        <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300">
          {deleteError}
        </p>
      )}

      {addresses.loading && <LoadingState label="Loading saved addresses…" />}

      {!addresses.loading && addresses.error && (
        <ErrorState
          title="Could not load your addresses"
          message={addresses.error}
          onRetry={() => void addresses.reload()}
        />
      )}

      {!addresses.loading && !addresses.error && (addresses.data?.length || 0) === 0 && !draft && (
        <EmptyState
          icon={MapPin}
          title="No saved addresses yet"
          description="Add your delivery address to see which kitchen serves you."
          action={
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold"
            >
              Add address
            </button>
          }
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(addresses.data || []).map((address) => {
          const Icon = TYPE_ICON[address.type] || MapPin;
          return (
            <article
              key={address.id}
              className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white truncate">
                      {address.label || address.type}
                    </h3>
                    {address.isDefault && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                        <Check className="w-2.5 h-2.5" /> DEFAULT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-slate-300 leading-5">
                    {address.addressLine}
                    {address.landmark ? `, ${address.landmark}` : ''}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {address.city} {address.pincode}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setSaveError(null);
                    setDraft(toDraft(address));
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-[10px] font-extrabold text-gray-700 dark:text-slate-200"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                {!address.isDefault && (
                  <button
                    onClick={() => void makeDefault(address)}
                    disabled={defaultBusyId === address.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-[10px] font-extrabold text-gray-700 dark:text-slate-200 disabled:opacity-50"
                  >
                    {defaultBusyId === address.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Star className="w-3 h-3" />
                    )}
                    Make default
                  </button>
                )}
                <button
                  onClick={() => {
                    setDeleteError(null);
                    setDeleting(address);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this address?"
        description={
          deleting
            ? `${deleting.label} — ${deleting.addressLine}`
            : undefined
        }
        confirmLabel="Delete address"
        tone="danger"
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
};
