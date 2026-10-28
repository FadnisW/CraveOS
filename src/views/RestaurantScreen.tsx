'use client';

import React, { useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { api } from '../lib/api-client';
import { mapApiBrand, mapApiMenuItems, type ApiBrand } from '../lib/catalog-mapper';
import { useApi } from '../hooks/useApi';
import { CardSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import type { MenuItem } from '../types';
import {
  ArrowLeft,
  Check,
  MessageSquareQuote,
  Plus,
  Search,
  UtensilsCrossed,
} from 'lucide-react';

interface RestaurantScreenProps {
  slug: string;
  hubId?: string;
  onBack: () => void;
  onOpenItemModal: (item: MenuItem) => void;
}

interface BrandReviews {
  count: number;
  reviews: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: string;
  }>;
}

export const RestaurantScreen: React.FC<RestaurantScreenProps> = ({
  slug,
  hubId,
  onBack,
  onOpenItemModal,
}) => {
  const { addToCart, cartItems } = useCart();
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');

  const brandState = useApi<ApiBrand>(
    () => api.getBrandBySlug(slug, hubId),
    [slug, hubId],
  );
  const menuState = useApi<MenuItem[]>(
    async () => mapApiMenuItems(await api.getMenuItems(slug, undefined, hubId)),
    [slug, hubId],
  );
  const reviewState = useApi<BrandReviews>(
    () => api.reviews.getForBrand(slug),
    [slug],
  );

  const brand = brandState.data ? mapApiBrand(brandState.data) : null;
  const items = menuState.data || [];
  const showMemberPrice = user?.isMember === true;

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) {
      if (item.category) seen.add(item.category);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!item.isAvailable) return false;
      if (category !== 'All' && item.category !== category) return false;
      if (!term) return true;
      return `${item.name} ${item.description}`.toLowerCase().includes(term);
    });
  }, [items, category, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of filtered) {
      const key = item.category || 'Other';
      const group = map.get(key) || [];
      group.push(item);
      map.set(key, group);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="space-y-8 pb-20">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 text-xs font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to menu</span>
      </button>

      {brandState.loading && <div className="h-48 rounded-3xl bg-gray-100 dark:bg-slate-800 animate-pulse" />}

      {!brandState.loading && brandState.error && (
        <ErrorState
          title="Could not load this kitchen"
          message={brandState.error}
          onRetry={() => void brandState.reload()}
        />
      )}

      {brand && (
        <section className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative h-44 sm:h-60 bg-gradient-to-br from-slate-800 to-slate-950">
            {brand.heroImage ? (
              <img src={brand.heroImage} alt={brand.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                <UtensilsCrossed className="w-12 h-12" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-black text-white truncate">{brand.name}</h1>
                <p className="text-xs text-slate-300 line-clamp-1">{brand.tagline}</p>
              </div>
              {brand.logo && (
                <img
                  src={brand.logo}
                  alt=""
                  className="w-14 h-14 rounded-2xl object-cover border border-white/20 bg-white shrink-0"
                />
              )}
            </div>
          </div>
          <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-gray-500 dark:text-slate-400">
            <span>
              {brand.minOrderValue > 0
                ? `Minimum ₹${brand.minOrderValue}`
                : 'No minimum order'}
            </span>
            <span className={brand.isAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              {brand.isAvailable ? 'Open now' : 'Closed'}
            </span>
            {!hubId && (
              <span className="text-amber-600 dark:text-amber-400">
                Set a delivery address to see only what this hub can cook.
              </span>
            )}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Menu</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Live prices and availability for this kitchen.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this menu…"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategory('All')}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-extrabold border ${
                category === 'All'
                  ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'
              }`}
            >
              All
            </button>
            {categories.map((name) => (
              <button
                key={name}
                onClick={() => setCategory(name)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-extrabold border ${
                  category === name
                    ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {menuState.loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        )}

        {!menuState.loading && menuState.error && (
          <ErrorState
            title="Could not load this menu"
            message={menuState.error}
            onRetry={() => void menuState.reload()}
          />
        )}

        {!menuState.loading && !menuState.error && grouped.length === 0 && (
          <EmptyState
            icon={UtensilsCrossed}
            title="Nothing on this menu yet"
            description="The kitchen has no available dishes for this selection."
          />
        )}

        {grouped.map(([groupName, groupItems]) => (
          <div key={groupName} className="space-y-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-white">{groupName}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {groupItems.map((item) => {
                const inCart = cartItems.some((cartItem) => cartItem.item.id === item.id);
                const needsOptions = (item.customizationGroups?.length || 0) > 0;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                  >
                    <div className="relative h-32 bg-gray-100 dark:bg-slate-800">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <UtensilsCrossed className="w-7 h-7" />
                        </div>
                      )}
                      <span
                        className={`absolute top-2 left-2 w-4 h-4 rounded-sm border-2 bg-white flex items-center justify-center ${
                          item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                        }`}
                        title={item.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
                      >
                        <span className={`w-2 h-2 rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                      </span>
                    </div>

                    <div className="p-3 space-y-2">
                      <h4 className="text-sm font-extrabold text-gray-900 dark:text-white line-clamp-1">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 line-clamp-2 min-h-[2.2rem]">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-black text-gray-900 dark:text-white">
                            ₹{showMemberPrice ? item.memberPrice : item.mrp}
                          </span>
                          {showMemberPrice && item.memberPrice < item.mrp && (
                            <span className="text-[10px] text-gray-400 line-through">₹{item.mrp}</span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (needsOptions) onOpenItemModal(item);
                            else addToCart(item);
                          }}
                          disabled={!item.isAvailable}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold disabled:opacity-40"
                        >
                          {inCart ? (
                            <span className="inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> Added
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Plus className="w-3 h-3" /> Add
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquareQuote className="w-5 h-5 text-rose-500" />
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Customer reviews</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Written by verified customers after delivery. Published after moderation.
            </p>
          </div>
        </div>

        {reviewState.loading && (
          <div className="h-24 rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
        )}

        {!reviewState.loading && reviewState.error && (
          <ErrorState
            title="Could not load reviews"
            message={reviewState.error}
            onRetry={() => void reviewState.reload()}
          />
        )}

        {!reviewState.loading && !reviewState.error && (reviewState.data?.reviews.length || 0) === 0 && (
          <EmptyState
            icon={MessageSquareQuote}
            title="No published reviews yet"
            description="Reviews appear here after a verified customer writes one and support approves it."
          />
        )}

        {!reviewState.loading && !reviewState.error && (reviewState.data?.reviews.length || 0) > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reviewState.data!.reviews.map((review) => (
              <article
                key={review.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 space-y-2"
              >
                <p className="text-sm text-gray-700 dark:text-slate-200 leading-6 whitespace-pre-line">
                  {review.body}
                </p>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span className="font-bold">{review.author}</span>
                  <time dateTime={review.createdAt}>
                    {new Date(review.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
