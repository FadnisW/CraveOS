'use client';

import React, { useMemo, useState } from 'react';
import {
  BrandId,
  MenuItem,
  Brand,
  SavedAddress,
} from '../types';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { SpotlightCard } from '../components/SpotlightCard';
import { SplitText } from '../components/SplitText';
import { api } from '../lib/api-client';
import { mapApiBrands, mapApiMenuItems } from '../lib/catalog-mapper';
import { useApi } from '../hooks/useApi';
import { CardSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Drumstick,
  Flame,
  MapPin,
  Plus,
  Salad,
  Sandwich,
  Search,
  Soup,
  Sparkles,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react';
import { motion } from 'motion/react';

interface HomeScreenProps {
  onSelectBrand: (brandId: BrandId) => void;
  onOpenItemModal: (item: MenuItem) => void;
  onNavigate: (view: string) => void;
  onSelectCategory?: (category: string) => void;
  activeAddress: SavedAddress | null;
  onOpenAddressModal: () => void;
}

interface Catalogue {
  brands: Brand[];
  items: MenuItem[];
}

const CATEGORY_STYLES: Record<string, { icon: React.ElementType; className: string }> = {
  pizza: { icon: Flame, className: 'bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400' },
  thincrust: { icon: Flame, className: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400' },
  biryani: { icon: Soup, className: 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400' },
  thali: { icon: UtensilsCrossed, className: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' },
  bowl: { icon: Salad, className: 'bg-lime-100 text-lime-600 dark:bg-lime-950/50 dark:text-lime-400' },
  'high protein': { icon: Salad, className: 'bg-teal-100 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400' },
  rolls: { icon: Wheat, className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400' },
  sandwich: { icon: Sandwich, className: 'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400' },
  'chicken wings': { icon: Drumstick, className: 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400' },
  sweets: { icon: Sparkles, className: 'bg-pink-100 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400' },
};

function categoryStyle(name: string) {
  const key = name.trim().toLowerCase();
  return (
    CATEGORY_STYLES[key] || {
      icon: UtensilsCrossed,
      className: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300',
    }
  );
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectBrand,
  onOpenItemModal,
  onNavigate,
  onSelectCategory,
  activeAddress,
  onOpenAddressModal,
}) => {
  const { addToCart, cartItems } = useCart();
  const { user } = useUser();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const hubId = activeAddress?.resolvedHubId || undefined;

  // Only the brands and dishes the customer's hub can actually cook are shown.
  // Without an address the catalogue is the whole live menu, and the banner
  // below says so rather than pretending it is deliverable.
  const catalogue = useApi<Catalogue>(async () => {
    const [brandRows, itemRows] = await Promise.all([
      api.getBrands(hubId),
      api.getMenuItems(undefined, undefined, hubId),
    ]);
    return {
      brands: mapApiBrands(brandRows),
      items: mapApiMenuItems(itemRows),
    };
  }, [hubId]);

  const serviceability = useApi(
    () => api.resolveServiceability(activeAddress!.lat, activeAddress!.lng),
    [activeAddress?.id, activeAddress?.lat, activeAddress?.lng],
    !!activeAddress,
  );

  const brands = catalogue.data?.brands || [];
  const items = catalogue.data?.items || [];

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!item.category) continue;
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [items]);

  const visibleItems = useMemo(() => {
    const live = items.filter((item) => item.isAvailable);
    if (selectedCategory === 'All') return live.slice(0, 8);
    return live
      .filter((item) => item.category.toLowerCase().includes(selectedCategory.toLowerCase()))
      .slice(0, 8);
  }, [items, selectedCategory]);

  const showMemberPrice = user?.isMember === true;

  return (
    <div className="space-y-10 pb-20">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 text-white p-7 sm:p-10">
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="absolute -bottom-28 -left-10 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Live menu from Bengaluru cloud kitchens
          </div>

          <h1 className="text-3xl sm:text-5xl font-black leading-[1.05] tracking-tight">
            <SplitText text="Real food." />
            <br />
            <span className="text-rose-400">
              <SplitText text="Real kitchens." delay={0.1} />
            </span>
          </h1>

          <p className="text-sm text-slate-300 max-w-lg">
            Browse what is actually cooking right now. Prices, availability, and
            brands come straight from the kitchen database.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => {
                setSelectedCategory('All');
                onNavigate('menu');
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold"
            >
              Browse the menu
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenAddressModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-extrabold"
            >
              <MapPin className="w-4 h-4" />
              {activeAddress ? 'Change address' : 'Set delivery address'}
            </button>
          </div>
        </div>
      </section>

      <section>
        {!activeAddress && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                Where should we deliver?
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Add an address to check which hub serves you.
              </p>
            </div>
            <button
              onClick={onOpenAddressModal}
              className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold"
            >
              Add address
            </button>
          </div>
        )}

        {activeAddress && serviceability.loading && (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-xs font-bold text-gray-500 dark:text-slate-400">
            Checking delivery availability for {activeAddress.label}…
          </div>
        )}

        {activeAddress && !serviceability.loading && serviceability.error && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-5 py-4 text-xs font-bold text-rose-700 dark:text-rose-300">
            Could not check delivery availability. {serviceability.error}
          </div>
        )}

        {activeAddress &&
          !serviceability.loading &&
          !serviceability.error &&
          serviceability.data?.isServiceable === false && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <p className="text-sm font-extrabold text-rose-900 dark:text-rose-200">
                  We do not deliver to this address yet
                </p>
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  {serviceability.data?.message ||
                    'Our two Bengaluru hubs do not cover this location.'}
                </p>
              </div>
              <button
                onClick={onOpenAddressModal}
                className="shrink-0 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold"
              >
                Change address
              </button>
            </div>
          )}

        {activeAddress &&
          !serviceability.loading &&
          !serviceability.error &&
          serviceability.data?.isServiceable === true && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-4 flex items-center gap-3">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                Delivering to {activeAddress.label}
                {serviceability.data?.hubName ? ` from ${serviceability.data.hubName}` : ''}.
              </p>
            </div>
          )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
              What are you craving?
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Categories are built from the live menu.
            </p>
          </div>
          <button
            onClick={() => onNavigate('menu')}
            className="text-xs font-extrabold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1"
          >
            Full menu <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {catalogue.loading && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-24 rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>
        )}

        {!catalogue.loading && !catalogue.error && categories.length === 0 && (
          <EmptyState
            title="No menu categories yet"
            description="The live catalogue is empty. Add menu items in the brand console."
          />
        )}

        {!catalogue.loading && categories.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {categories.map((category) => {
              const style = categoryStyle(category);
              const Icon = style.icon;
              const isSelected = selectedCategory === category;

              return (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategory(isSelected ? 'All' : category);
                    onSelectCategory?.(category);
                  }}
                  className={`rounded-2xl border p-3 text-center transition-all ${
                    isSelected
                      ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30 shadow-sm'
                      : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-200'
                  }`}
                >
                  <div
                    className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center ${style.className}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="mt-2 block text-[11px] font-extrabold text-gray-800 dark:text-slate-200 truncate">
                    {category}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
              The kitchens
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Every brand below is served by a real cloud kitchen hub.
            </p>
          </div>
        </div>

        {catalogue.loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        )}

        {!catalogue.loading && catalogue.error && (
          <ErrorState
            title="Could not load the kitchens"
            message={catalogue.error}
            onRetry={() => void catalogue.reload()}
          />
        )}

        {!catalogue.loading && !catalogue.error && brands.length === 0 && (
          <EmptyState
            icon={UtensilsCrossed}
            title="No kitchens are live"
            description="Brands will appear here once they are active and serving a hub."
          />
        )}

        {!catalogue.loading && !catalogue.error && brands.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.map((brand) => (
              <motion.button
                key={brand.id}
                whileHover={{ y: -3 }}
                onClick={() => brand.isAvailable && onSelectBrand(brand.id)}
                disabled={!brand.isAvailable}
                className="group text-left rounded-3xl overflow-hidden border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm disabled:opacity-60"
              >
                <div className="relative h-36 bg-gradient-to-br from-slate-800 to-slate-950">
                  {brand.heroImage ? (
                    <img
                      src={brand.heroImage}
                      alt={brand.name}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/40">
                      <UtensilsCrossed className="w-10 h-10" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />

                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white truncate">{brand.name}</p>
                      <p className="text-[10px] text-slate-300 line-clamp-1">{brand.tagline}</p>
                    </div>
                    {brand.logo && (
                      <img
                        src={brand.logo}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover border border-white/20 bg-white shrink-0"
                      />
                    )}
                  </div>
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                    {brand.minOrderValue > 0
                      ? `Minimum ₹${brand.minOrderValue}`
                      : 'No minimum order'}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-lg ${
                      brand.isAvailable
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {brand.isAvailable ? 'Open' : 'Closed'}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
              {selectedCategory === 'All' ? 'Popular right now' : selectedCategory}
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Prices and availability come from the kitchen database.
            </p>
          </div>
          <button
            onClick={() => onNavigate('search')}
            className="text-xs font-extrabold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1"
          >
            <Search className="w-3.5 h-3.5" /> Search
          </button>
        </div>

        {catalogue.loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        )}

        {!catalogue.loading && !catalogue.error && visibleItems.length === 0 && (
          <EmptyState
            title="Nothing available in this category"
            description="Try another category or check back when the kitchen restocks."
          />
        )}

        {!catalogue.loading && !catalogue.error && visibleItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleItems.map((item) => {
              const inCart = cartItems.some((cartItem) => cartItem.item.id === item.id);
              const needsOptions = (item.customizationGroups?.length || 0) > 0;

              return (
                <SpotlightCard
                  key={item.id}
                  className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                >
                  <div className="relative h-36 bg-gray-100 dark:bg-slate-800">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <UtensilsCrossed className="w-8 h-8" />
                      </div>
                    )}
                    {item.isBestseller && (
                      <span className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-amber-500 text-white text-[9px] font-black uppercase">
                        Bestseller
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-2">
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
                          <span className="text-[10px] text-gray-400 line-through">₹{item.mrp}</span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          if (needsOptions) onOpenItemModal(item);
                          else addToCart(item);
                        }}
                        disabled={!item.isAvailable}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold disabled:opacity-40"
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
                </SpotlightCard>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
