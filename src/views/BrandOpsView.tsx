'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api-client';
import { useUser } from '../context/UserContext';
import { ConfirmDialog } from '../components/ui/Dialog';
import {
  AlertCircle,
  BadgeIndianRupee,
  BarChart3,
  CheckCircle2,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Store,
  Tag,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';

type Tab = 'overview' | 'menu' | 'promotions' | 'analytics' | 'finance';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Store className="w-4 h-4" /> },
  { id: 'menu', label: 'Menu', icon: <UtensilsCrossed className="w-4 h-4" /> },
  { id: 'promotions', label: 'Promotions', icon: <Megaphone className="w-4 h-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'finance', label: 'Finance', icon: <BadgeIndianRupee className="w-4 h-4" /> },
];

function rupees(paise: number | undefined | null) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

function emptyDraft() {
  return {
    name: '',
    description: '',
    category: 'Main Course',
    mrpRupees: '',
    memberRupees: '',
    imageUrl: '',
    isVeg: true,
    isAvailable: true,
  };
}

export const BrandOpsView: React.FC = () => {
  const { user } = useUser();
  const isAdmin = user?.role === 'ADMIN';

  const [brands, setBrands] = useState<any[]>([]);
  const [brandId, setBrandId] = useState<string>(user?.scopedBrandId || '');
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<any>(null);
  const [menu, setMenu] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [finance, setFinance] = useState<any>(null);
  const [menuQuery, setMenuQuery] = useState<string>('');

  const [draft, setDraft] = useState(emptyDraft());
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [savingItem, setSavingItem] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deletingItem, setDeletingItem] = useState<boolean>(false);
  const [bulkPct, setBulkPct] = useState<string>('');
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  const [promoType, setPromoType] = useState<'HAPPY_HOUR' | 'MEAL_OF_DAY' | 'BOGO' | 'COUPON'>(
    'HAPPY_HOUR',
  );
  const [promoDiscount, setPromoDiscount] = useState<string>('15');
  const [promoStart, setPromoStart] = useState<string>('');
  const [promoEnd, setPromoEnd] = useState<string>('');
  const [promoBusy, setPromoBusy] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getBrands()
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setBrands(list);
        setBrandId((current) => {
          if (current) return current;
          if (user?.scopedBrandId) return user.scopedBrandId;
          return isAdmin ? list[0]?.id || '' : '';
        });
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Failed to load brands.');
      });
    return () => {
      cancelled = true;
    };
  }, [user?.scopedBrandId, isAdmin]);

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === brandId) || null,
    [brands, brandId],
  );

  const loadTab = useCallback(async () => {
    if (!brandId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (tab === 'overview') {
        setDashboard(await api.brandOps.getDashboard(brandId));
      } else if (tab === 'menu') {
        setMenu(await api.brandOps.getMenu(brandId));
      } else if (tab === 'analytics') {
        setAnalytics(await api.brandOps.getAnalytics(brandId));
      } else if (tab === 'finance') {
        setFinance(await api.brandOps.getFinance(brandId));
      }
    } catch (err: any) {
      setError(err?.message || `Failed to load ${tab}.`);
    } finally {
      setLoading(false);
    }
  }, [brandId, tab]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!brandId) return;

    const mrp = Number(draft.mrpRupees);
    const member = draft.memberRupees ? Number(draft.memberRupees) : undefined;
    if (!Number.isFinite(mrp) || mrp <= 0) {
      setError('MRP must be a positive amount in rupees.');
      return;
    }
    if (member !== undefined && (!Number.isFinite(member) || member <= 0 || member > mrp)) {
      setError('Member price must be positive and cannot exceed MRP.');
      return;
    }

    setSavingItem(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        category: draft.category.trim() || 'Main Course',
        mrpInPaise: Math.round(mrp * 100),
        memberPriceInPaise: member !== undefined ? Math.round(member * 100) : undefined,
        imageUrl: draft.imageUrl.trim() || undefined,
        isVeg: draft.isVeg,
        dietType: draft.isVeg ? 'VEG' : 'NON_VEG',
        isAvailable: draft.isAvailable,
      };

      if (editingItem) {
        await api.brandOps.updateMenuItem(brandId, editingItem.id, payload);
        setMessage(`${payload.name} updated.`);
      } else {
        await api.brandOps.createMenuItem(brandId, payload);
        setMessage(`${payload.name} added to the menu.`);
      }

      setDraft(emptyDraft());
      setEditingItem(null);
      await loadTab();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Could not save this menu item.');
    } finally {
      setSavingItem(false);
    }
  };

  const startEdit = (item: any) => {
    setEditingItem(item);
    setDraft({
      name: item.name || '',
      description: item.description || '',
      category: item.category || 'Main Course',
      mrpRupees: String((Number(item.mrpInPaise) || 0) / 100),
      memberRupees: String((Number(item.memberPriceInPaise) || 0) / 100),
      imageUrl: item.imageUrl || '',
      isVeg: item.isVeg !== false,
      isAvailable: item.isAvailable !== false,
    });
  };

  const removeItem = (item: any) => {
    setDeleteTarget(item);
  };

  const confirmRemoveItem = async () => {
    if (!deleteTarget) return;

    setDeletingItem(true);
    setError(null);
    try {
      await api.brandOps.deleteMenuItem(brandId, deleteTarget.id);
      setMessage(`${deleteTarget.name} deleted.`);
      setDeleteTarget(null);
      await loadTab();
    } catch (err: any) {
      setError(err?.message || 'Could not delete this item.');
    } finally {
      setDeletingItem(false);
    }
  };

  const toggleAvailability = async (item: any) => {
    try {
      await api.brandOps.updateMenuItem(brandId, item.id, {
        isAvailable: !item.isAvailable,
      });
      setMenu((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, isAvailable: !item.isAvailable } : row,
        ),
      );
    } catch (err: any) {
      setError(err?.message || 'Could not update availability.');
    }
  };

  const applyBulkPrice = async () => {
    const pct = Number(bulkPct);
    if (!Number.isFinite(pct) || pct === 0) {
      setError('Enter a non-zero percentage to adjust prices.');
      return;
    }
    setBulkBusy(true);
    setError(null);
    try {
      const updates = menu.map((item) => {
        const mrp = Math.max(100, Math.round((Number(item.mrpInPaise) || 0) * (1 + pct / 100)));
        const member = Math.max(
          100,
          Math.round((Number(item.memberPriceInPaise) || mrp) * (1 + pct / 100)),
        );
        return {
          itemId: item.id,
          mrpInPaise: mrp,
          memberPriceInPaise: Math.min(member, mrp),
        };
      });
      await api.brandOps.bulkUpdatePrice(brandId, updates);
      setMessage(`Prices adjusted by ${pct > 0 ? '+' : ''}${pct}% across ${updates.length} items.`);
      setBulkPct('');
      await loadTab();
    } catch (err: any) {
      setError(err?.message || 'Bulk price update failed.');
    } finally {
      setBulkBusy(false);
    }
  };

  const proposePromotion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!brandId) return;
    if (!promoStart || !promoEnd) {
      setError('Choose a start and end date for the promotion.');
      return;
    }

    setPromoBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.brandOps.proposePromotion(brandId, {
        type: promoType,
        startsAt: new Date(promoStart).toISOString(),
        endsAt: new Date(promoEnd).toISOString(),
        config: { discountPct: Number(promoDiscount) || 0, minOrderPaise: 0 },
      });
      setMessage('Promotion submitted for marketing approval.');
      setPromoStart('');
      setPromoEnd('');
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Could not submit this promotion.');
    } finally {
      setPromoBusy(false);
    }
  };

  const filteredMenu = menu.filter(
    (item) =>
      !menuQuery.trim() ||
      String(item.name || '').toLowerCase().includes(menuQuery.toLowerCase()) ||
      String(item.category || '').toLowerCase().includes(menuQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">Brand Operations Console</h1>
            <p className="text-xs text-slate-400">
              {selectedBrand?.name || 'Select a brand'} • menu, promotions, analytics & settlement
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <select
              value={brandId}
              onChange={(event) => setBrandId(event.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold"
            >
              <option value="">Select brand…</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={loadTab}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5"
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

      {!brandId ? (
        <div className="p-12 text-center text-sm text-gray-400 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800">
          This account is not linked to a brand. Ask a super admin to set your scoped brand.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {TABS.map((candidate) => (
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
            <div className="p-12 text-center text-sm text-gray-400">Loading {tab}…</div>
          ) : (
            <>
              {tab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      ['Orders today', dashboard?.metrics?.todayOrderCount ?? '—'],
                      ['Revenue today', rupees(dashboard?.metrics?.todayRevenuePaise)],
                      ['Lifetime orders', dashboard?.metrics?.totalOrderCount ?? '—'],
                      ['Lifetime revenue', rupees(dashboard?.metrics?.lifetimeRevenuePaise)],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800"
                      >
                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                          {label}
                        </div>
                        <div className="text-xl font-black text-gray-900 dark:text-white">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800">
                    <h2 className="text-sm font-extrabold text-gray-900 dark:text-white mb-3">
                      Kitchens serving this brand
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(dashboard?.brand?.activeHubs || []).map((hub: any) => (
                        <div
                          key={hub.hubId}
                          className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700"
                        >
                          <div className="text-xs font-bold text-gray-900 dark:text-white">
                            {hub.hubName}
                          </div>
                          <div
                            className={`text-[10px] font-bold ${
                              hub.isOpen ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {hub.isOpen ? 'Kitchen open' : 'Kitchen closed'}
                          </div>
                        </div>
                      ))}
                      {(dashboard?.brand?.activeHubs || []).length === 0 && (
                        <div className="text-xs text-gray-400">No kitchens linked yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'menu' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
                      <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">
                        Menu ({menu.length})
                      </h2>
                      <input
                        value={menuQuery}
                        onChange={(event) => setMenuQuery(event.target.value)}
                        placeholder="Search menu…"
                        className="ml-auto px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          value={bulkPct}
                          onChange={(event) => setBulkPct(event.target.value)}
                          placeholder="±%"
                          className="w-16 px-2 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-center font-bold text-gray-900 dark:text-white"
                        />
                        <button
                          onClick={applyBulkPrice}
                          disabled={bulkBusy || menu.length === 0}
                          className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-bold disabled:opacity-50"
                        >
                          {bulkBusy ? 'Applying…' : 'Bulk price'}
                        </button>
                      </div>
                    </div>

                    {filteredMenu.length === 0 ? (
                      <div className="p-10 text-center text-xs text-gray-400">No menu items.</div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[560px] overflow-y-auto">
                        {filteredMenu.map((item) => (
                          <div key={item.id} className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0">
                              {item.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {item.name}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {item.category} • MRP {rupees(item.mrpInPaise)} • Member{' '}
                                {rupees(item.memberPriceInPaise)}
                              </div>
                            </div>
                            <button
                              onClick={() => toggleAvailability(item)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                                item.isAvailable
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {item.isAvailable ? 'Live' : "86'd"}
                            </button>
                            <button
                              onClick={() => startEdit(item)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-gray-100 dark:hover:bg-slate-800"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeItem(item)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-gray-100 dark:hover:bg-slate-800"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={saveItem}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-5 space-y-3 h-fit"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                        {editingItem ? 'Edit item' : 'Add menu item'}
                      </h3>
                      {editingItem && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(null);
                            setDraft(emptyDraft());
                          }}
                          className="text-gray-400 hover:text-rose-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <Field label="Name">
                      <input
                        required
                        value={draft.name}
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                      />
                    </Field>

                    <Field label="Description">
                      <textarea
                        rows={2}
                        value={draft.description}
                        onChange={(event) =>
                          setDraft({ ...draft, description: event.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Category">
                        <input
                          value={draft.category}
                          onChange={(event) =>
                            setDraft({ ...draft, category: event.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                        />
                      </Field>
                      <Field label="Image URL">
                        <input
                          value={draft.imageUrl}
                          onChange={(event) =>
                            setDraft({ ...draft, imageUrl: event.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Field label="MRP (₹)">
                        <input
                          required
                          type="number"
                          min="1"
                          step="0.01"
                          value={draft.mrpRupees}
                          onChange={(event) =>
                            setDraft({ ...draft, mrpRupees: event.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                        />
                      </Field>
                      <Field label="Member price (₹)">
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={draft.memberRupees}
                          onChange={(event) =>
                            setDraft({ ...draft, memberRupees: event.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                        />
                      </Field>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-bold text-gray-600 dark:text-slate-300">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={draft.isVeg}
                          onChange={(event) =>
                            setDraft({ ...draft, isVeg: event.target.checked })
                          }
                        />
                        Vegetarian
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={draft.isAvailable}
                          onChange={(event) =>
                            setDraft({ ...draft, isAvailable: event.target.checked })
                          }
                        />
                        Available
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={savingItem}
                      className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {savingItem ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : editingItem ? (
                        <Save className="w-3.5 h-3.5" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      {savingItem ? 'Saving…' : editingItem ? 'Save changes' : 'Add item'}
                    </button>
                  </form>
                </div>
              )}

              {tab === 'promotions' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <form
                    onSubmit={proposePromotion}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-6 space-y-3"
                  >
                    <h2 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                      <Tag className="w-4 h-4 text-rose-500" />
                      Propose a promotion
                    </h2>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">
                      Proposals are invisible to customers until a marketing admin approves them.
                    </p>

                    <Field label="Promotion type">
                      <select
                        value={promoType}
                        onChange={(event) => setPromoType(event.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-900 dark:text-white"
                      >
                        <option value="HAPPY_HOUR">Happy Hour</option>
                        <option value="MEAL_OF_DAY">Meal of the Day</option>
                        <option value="BOGO">Buy One Get One</option>
                        <option value="COUPON">Coupon</option>
                      </select>
                    </Field>

                    <Field label="Discount %">
                      <input
                        type="number"
                        min="0"
                        max="90"
                        value={promoDiscount}
                        onChange={(event) => setPromoDiscount(event.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Starts at">
                        <input
                          required
                          type="datetime-local"
                          value={promoStart}
                          onChange={(event) => setPromoStart(event.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                        />
                      </Field>
                      <Field label="Ends at">
                        <input
                          required
                          type="datetime-local"
                          value={promoEnd}
                          onChange={(event) => setPromoEnd(event.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                        />
                      </Field>
                    </div>

                    <button
                      type="submit"
                      disabled={promoBusy}
                      className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold disabled:opacity-50"
                    >
                      {promoBusy ? 'Submitting…' : 'Submit for approval'}
                    </button>
                  </form>

                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-3xl border border-amber-200 dark:border-amber-900 p-6 space-y-2">
                    <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                      How approval works
                    </h3>
                    <ol className="text-xs text-amber-800 dark:text-amber-300 space-y-1.5 list-decimal list-inside">
                      <li>You submit the promotion with its window and discount.</li>
                      <li>The pricing engine ignores it while it is pending.</li>
                      <li>A marketing admin approves or rejects it.</li>
                      <li>Only approved, in-window offers reach the storefront.</li>
                    </ol>
                  </div>
                </div>
              )}

              {tab === 'analytics' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      ['Total brand orders', analytics?.totalOrders ?? '—'],
                      ['Rejected tickets', analytics?.rejectedOrders ?? '—'],
                      ['Rejection rate', `${analytics?.rejectionRatePct ?? 0}%`],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800"
                      >
                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                          {label}
                        </div>
                        <div className="text-xl font-black text-gray-900 dark:text-white">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 dark:border-slate-800 text-sm font-extrabold text-gray-900 dark:text-white">
                      Top sellers
                    </div>
                    {(analytics?.topSellers || []).length === 0 ? (
                      <div className="p-10 text-center text-xs text-gray-400">
                        No sales recorded yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-slate-800">
                        {(analytics?.topSellers || []).map((item: any) => (
                          <div
                            key={item.menuItemId}
                            className="p-4 flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-gray-900 dark:text-white">
                              {item.name}
                            </span>
                            <span className="text-gray-500 dark:text-slate-400">
                              {item.quantitySold} sold • {rupees(item.revenuePaise)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'finance' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Metric label="Settled GMV" value={rupees(finance?.grossMerchandiseValuePaise)} />
                  <Metric label="Fulfilled orders" value={finance?.fulfilledOrdersCount ?? 0} />
                  <Metric label="Average ticket" value={`₹${finance?.avgTicketValueRupees ?? 0}`} />
                  <Metric
                    label="Basis"
                    value="Paid orders only"
                    hint="Cancelled and rejected tickets excluded"
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this menu item?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed from the menu. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete item"
        tone="danger"
        busy={deletingItem}
        onConfirm={confirmRemoveItem}
        onClose={() => {
          if (!deletingItem) setDeleteTarget(null);
        }}
      />
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</span>
    {children}
  </label>
);

const Metric: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({
  label,
  value,
  hint,
}) => (
  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
    <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</div>
    <div className="text-xl font-black text-gray-900 dark:text-white">{value}</div>
    {hint && <div className="text-[10px] text-gray-400 mt-1">{hint}</div>}
  </div>
);
