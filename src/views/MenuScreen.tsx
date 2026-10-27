'use client';

import React, { useMemo, useState } from 'react';
import { MenuItem, Brand } from '../types';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { api } from '../lib/api-client';
import { mapApiBrands, mapApiMenuItems } from '../lib/catalog-mapper';
import { useApi } from '../hooks/useApi';
import { CardSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import {
  ArrowLeft,
  Check,
  Flame,
  Plus,
  Search,
  SlidersHorizontal,
  UtensilsCrossed,
} from 'lucide-react';

interface MenuScreenProps {
  initialCategory?: string;
  initialBrandId?: string | null;
  onBack: () => void;
  onOpenItemModal: (item: MenuItem) => void;
}

interface Catalogue {
  brands: Brand[];
  items: MenuItem[];
}

export const MenuScreen: React.FC<MenuScreenProps> = ({
  initialCategory = '',
  initialBrandId = null,
  onBack,
  onOpenItemModal,
}) => {
  const { addToCart, cartItems } = useCart();
  const { user } = useUser();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dietFilter, setDietFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [bestsellerOnly, setBestsellerOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const catalogue = useApi<Catalogue>(async () => {
    const [brandRows, itemRows] = await Promise.all([
      api.getBrands(),
      api.getMenuItems(initialBrandId || undefined),
    ]);
    return {
      brands: mapApiBrands(brandRows),
      items: mapApiMenuItems(itemRows),
    };
  }, [initialBrandId]);

  const items = catalogue.data?.items || [];
  const brands = catalogue.data?.brands || [];
  const activeBrand = initialBrandId
    ? brands.find((brand) => brand.id === initialBrandId) || null
    : null;

  const brandItems = useMemo(
    () => (initialBrandId ? items.filter((item) => item.brandId === initialBrandId) : items),
    [items, initialBrandId],
  );

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const item of brandItems) {
      if (item.category) seen.add(item.category);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [brandItems]);

  const initialMatch = useMemo(() => {
    if (!initialCategory) return 'All';
    return (
      categories.find(
        (category) =>
          category.toLowerCase() === initialCategory.toLowerCase() ||
          category.toLowerCase().includes(initialCategory.toLowerCase()),
      ) || 'All'
    );
  }, [categories, initialCategory]);

  const activeCategory = selectedCategory ?? initialMatch;

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return brandItems.filter((item) => {
      if (!item.isAvailable) return false;

      if (dietFilter === 'VEG' && item.isVeg !== true) return false;
      if (dietFilter === 'NON_VEG' && item.isVeg !== false) return false;
      if (bestsellerOnly && item.isBestseller !== true) return false;

      if (activeCategory !== 'All' && item.category !== activeCategory) return false;

      if (query) {
        const haystack = `${item.name} ${item.description} ${item.brandName || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [brandItems, dietFilter, bestsellerOnly, activeCategory, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of filteredItems) {
      const key = item.category || 'Other';
      const group = map.get(key) || [];
      group.push(item);
      map.set(key, group);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredItems]);

  const showMemberPrice = user?.isMember === true;

  const scrollToCategory = (category: string) => {
    setSelectedCategory(category);
    if (category === 'All') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const target = document.getElementById(`category-${category.replace(/\s+/g, '-')}`);
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 170;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div className="pb-20 space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 text-xs font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      {activeBrand && (
        <section className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative h-40 sm:h-52 bg-gradient-to-br from-slate-800 to-slate-950">
            {activeBrand.heroImage ? (
              <img
                src={activeBrand.heroImage}
                alt={activeBrand.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                <UtensilsCrossed className="w-12 h-12" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-white truncate">
                  {activeBrand.name}
                </h1>
                <p className="text-xs text-slate-300 line-clamp-1">{activeBrand.tagline}</p>
              </div>
              {activeBrand.logo && (
                <img
                  src={activeBrand.logo}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover border border-white/20 bg-white shrink-0"
                />
              )}
            </div>
          </div>
          <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-gray-500 dark:text-slate-400">
            <span>
              {activeBrand.minOrderValue > 0
                ? `Minimum order ₹${activeBrand.minOrderValue}`
                : 'No minimum order'}
            </span>
            <span
              className={
                activeBrand.isAvailable
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }
            >
              {activeBrand.isAvailable ? 'Open now' : 'Closed'}
            </span>
          </div>
        </section>
      )}

      <section className="sticky top-[88px] z-30 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-gray-50/95 dark:bg-slate-950/95 backdrop-blur-md space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search this menu..."
            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white focus:border-rose-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-gray-400">
            <SlidersHorizontal className="w-3 h-3" /> Filter
          </span>

          {(['ALL', 'VEG', 'NON_VEG'] as const).map((diet) => (
            <button
              key={diet}
              onClick={() => setDietFilter(diet)}
              className={`shrink-0 px-3 py-1 rounded-lg text-[11px] font-extrabold border ${
                dietFilter === diet
                  ? 'bg-rose-600 border-rose-600 text-white'
                  : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'
              }`}
            >
              {diet === 'ALL' ? 'All' : diet === 'VEG' ? 'Veg' : 'Non-veg'}
            </button>
          ))}

          <button
            onClick={() => setBestsellerOnly((value) => !value)}
            className={`shrink-0 px-3 py-1 rounded-lg text-[11px] font-extrabold border ${
              bestsellerOnly
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'
            }`}
          >
            Bestsellers
          </button>
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => scrollToCategory('All')}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-extrabold border ${
                activeCategory === 'All'
                  ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => scrollToCategory(category)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-extrabold border ${
                  activeCategory === category
                    ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        )}
      </section>

      {catalogue.loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      )}

      {!catalogue.loading && catalogue.error && (
        <ErrorState
          title="Could not load the menu"
          message={catalogue.error}
          onRetry={() => void catalogue.reload()}
        />
      )}

      {!catalogue.loading && !catalogue.error && grouped.length === 0 && (
        <EmptyState
          icon={UtensilsCrossed}
          title="No dishes match these filters"
          description="Clear the search or filters, or check back when the kitchen restocks."
        />
      )}

      {!catalogue.loading && !catalogue.error && grouped.length > 0 && (
        <div className="space-y-8">
          {grouped.map(([category, categoryItems]) => (
            <section
              key={category}
              id={`category-${category.replace(/\s+/g, '-')}`}
              className="space-y-3 scroll-mt-40"
            >
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" />
                <h2 className="text-base font-black text-gray-900 dark:text-white">{category}</h2>
                <span className="text-[10px] font-bold text-gray-400">
                  {categoryItems.length} item{categoryItems.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {categoryItems.map((item) => {
                  const inCart = cartItems.some((cartItem) => cartItem.item.id === item.id);
                  const needsOptions = (item.customizationGroups?.length || 0) > 0;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                    >
                      <div className="relative h-32 bg-gray-100 dark:bg-slate-800">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <UtensilsCrossed className="w-7 h-7" />
                          </div>
                        )}
                        <span
                          className={`absolute top-2 left-2 w-4 h-4 rounded-sm border-2 bg-white flex items-center justify-center ${
                            item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          />
                        </span>
                        {item.isBestseller && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-black uppercase">
                            Bestseller
                          </span>
                        )}
                      </div>

                      <div className="p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase text-rose-500 truncate">
                          {item.brandName || item.brandId.replace(/-/g, ' ')}
                        </p>
                        <h3 className="text-sm font-extrabold text-gray-900 dark:text-white line-clamp-1">
                          {item.name}
                        </h3>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 line-clamp-2 min-h-[2.2rem]">
                          {item.description}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-black text-gray-900 dark:text-white">
                              ₹{showMemberPrice ? item.memberPrice : item.mrp}
                            </span>
                            {showMemberPrice && item.memberPrice < item.mrp && (
                              <span className="text-[10px] text-gray-400 line-through">
                                ₹{item.mrp}
                              </span>
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
