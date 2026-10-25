'use client';

import React, { useState, useEffect } from 'react';
import { MOCK_BRANDS, MOCK_MENU_ITEMS } from '../data/mockData';
import { BrandId, MenuItem, Brand } from '../types';
import { useCart } from '../context/CartContext';
import { api } from '../lib/api-client';
import { Star, Clock, ArrowLeft, Plus, Check, Search, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface RestaurantViewProps {
  brandId: BrandId;
  onBack: () => void;
  onOpenItemModal: (item: MenuItem) => void;
}

export const RestaurantView: React.FC<RestaurantViewProps> = ({
  brandId,
  onBack,
  onOpenItemModal,
}) => {
  const { addToCart, cartItems } = useCart();
  const [brand, setBrand] = useState<Brand>(() => MOCK_BRANDS.find((b) => b.id === brandId) || MOCK_BRANDS[0]);
  const [brandItems, setBrandItems] = useState<MenuItem[]>(() => MOCK_MENU_ITEMS.filter((item) => item.brandId === brandId));

  useEffect(() => {
    async function fetchBrandDetails() {
      try {
        const [apiBrand, apiItems] = await Promise.all([
          api.getBrandBySlug(brandId).catch(() => null),
          api.getMenuItems(brandId).catch(() => null),
        ]);

        if (apiBrand) {
          setBrand({
            id: apiBrand.slug || apiBrand.id,
            name: apiBrand.name,
            tagline: apiBrand.cuisine?.join(', ') || 'Desi Meals & Specialties',
            logo: apiBrand.logoUrl || MOCK_BRANDS[0].logo,
            heroImage: apiBrand.heroImageUrl || MOCK_BRANDS[0].heroImage,
            themeColor: apiBrand.themeColor || '#E11D48',
            rating: 4.7,
            totalRatings: 18000,
            deliveryTimeMins: 22,
            minOrderValue:
              Number(apiBrand.minOrderValue) > 0
                ? Math.round(Number(apiBrand.minOrderValue) / 100)
                : 149,
            categories: apiBrand.cuisine || ['All'],
            isAvailable: apiBrand.isActive ?? true,
            isOwned: apiBrand.isOwned ?? true,
            commissionPct: apiBrand.commissionPct,
          });
        }

        if (apiItems && Array.isArray(apiItems) && apiItems.length > 0) {
          const mappedItems: MenuItem[] = apiItems.map((i: any) => ({
            id: i.id,
            brandId: i.brandKitchen?.brand?.slug || brandId,
            availableHubIds: (i.brandKitchen?.brand?.brandKitchens ?? []).map((bk: { hubId: string }) => bk.hubId).filter(Boolean),
            name: i.name,
            description: i.description || i.name,
            mrp: (Number(i.mrpInPaise) > 0 ? Number(i.mrpInPaise) : 30000) / 100,
            memberPrice:
              (Number(i.memberPriceInPaise) > 0
                ? Number(i.memberPriceInPaise)
                : Number(i.mrpInPaise) > 0
                  ? Number(i.mrpInPaise)
                  : 30000) / 100,
            image:
              i.imageUrl ||
              'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80',
            isVeg: i.isVeg ?? true,
            isBestseller: true,
            category: i.category || 'Popular',
            rating: 4.8,
            isAvailable: i.isAvailable ?? true,
          }));
          setBrandItems(mappedItems);
        }
      } catch (e) {
        console.warn('Could not fetch live brand details:', e);
      }
    }
    fetchBrandDetails();
  }, [brandId]);

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = brandItems.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to All Brands</span>
      </button>

      {/* Brand Hero Header */}
      <div className="relative rounded-3xl overflow-hidden bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="h-44 sm:h-56 relative overflow-hidden">
          <img
            src={brand.heroImage}
            alt={brand.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        </div>

        <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 -mt-12 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white dark:border-slate-800 shadow-md shrink-0 bg-white">
              <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" />
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                {brand.name}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                {brand.tagline}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-center">
              <div className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{brand.rating}</span>
              </div>
              <span className="text-[9px] text-amber-600/80 dark:text-amber-500">{brand.totalRatings.toLocaleString()} ratings</span>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-center">
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{brand.deliveryTimeMins} mins</span>
              </div>
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500">₹0 Delivery Fee</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Navigation Bar & Search */}
      <div className="sticky top-16 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md py-3 px-2 rounded-2xl border border-gray-200/80 dark:border-slate-800/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto scrollbar-none">
          {['All', ...brand.categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search within Menu */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={`Search ${brand.name}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-xs text-gray-900 dark:text-white border border-transparent focus:border-rose-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Menu Item Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const isAdded = cartItems.some((ci) => ci.item.id === item.id);
          return (
            <motion.div
              key={item.id}
              whileHover={{ y: -3 }}
              className="flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-all duration-200 group"
            >
              {/* Full-width food banner image */}
              <div className="relative w-full h-44 overflow-hidden bg-gray-100 dark:bg-slate-800">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

                {/* Veg / Non-Veg Indicator */}
                <div className={`absolute top-3 left-3 w-4 h-4 rounded-sm flex items-center justify-center border bg-white/90 backdrop-blur-sm shadow-sm ${
                  item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                </div>

                {/* Rating Badge */}
                <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>{item.rating}</span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white line-clamp-1 group-hover:text-rose-600 transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700/80">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-black text-gray-900 dark:text-white">
                        ₹{item.memberPrice}
                      </span>
                      <span className="text-xs text-gray-400 line-through">
                        ₹{item.mrp}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Member Price
                    </span>
                  </div>

                  {item.customizationGroups && item.customizationGroups.length > 0 ? (
                    <button
                      onClick={() => onOpenItemModal(item)}
                      className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-xs font-extrabold transition-all"
                    >
                      Customize +
                    </button>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                        isAdded
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/20'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Added
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" /> ADD
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
