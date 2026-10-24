'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MOCK_BRANDS, MOCK_MENU_ITEMS } from '../data/mockData';
import { MenuItem, Brand } from '../types';
import { useCart } from '../context/CartContext';
import { api } from '../lib/api-client';
import {
  ArrowLeft,
  Search,
  Plus,
  Check,
  Star,
  ShieldCheck,
  Flame,
  Clock,
  Sparkles,
  ChevronRight,
  Filter,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SpotlightCard } from '../components/SpotlightCard';
import NextImage from 'next/image';

interface MenuScreenProps {
  initialCategory?: string;
  initialBrandId?: string | null;
  onBack: () => void;
  onOpenItemModal: (item: MenuItem) => void;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({
  initialCategory = 'Pizza',
  initialBrandId = null,
  onBack,
  onOpenItemModal,
}) => {
  const { addToCart, cartItems } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [dietFilter, setDietFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [bestsellerOnly, setBestsellerOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MOCK_MENU_ITEMS);
  const [brands, setBrands] = useState<Brand[]>(MOCK_BRANDS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // All possible category sidebar items across all brands
  const allSidebarCategories = [
    { id: 'Pizza', name: 'Pizzas | 2X Toppings', icon: '🍕', brandId: 'mojo-pizza' },
    { id: 'ThinCrust', name: 'Thin Crust Pizzas', icon: '🍕', brandId: 'leancrust' },
    { id: 'Thali', name: 'Desi Thalis & Meals', icon: '🍱', brandId: 'box8' },
    { id: 'Biryani', name: 'Mughal Dum Biryanis', icon: '🍲', brandId: 'zaza-biryani' },
    { id: 'Bowl', name: 'North Indian Bowls', icon: '🍚', brandId: 'nh1-bowls' },
    { id: 'High Protein', name: 'Protein & Health Bowls', icon: '🥗', brandId: 'wefit' },
    { id: 'Rolls', name: 'Loaded 8" Wraps & Rolls', icon: '🌯', brandId: 'mealful-rolls' },
    { id: 'Sandwich', name: 'Gourmet Sandwiches', icon: '🥪', brandId: 'wefit' },
    { id: 'Chicken Wings', name: 'Wings & Appetizers', icon: '🍗', brandId: 'mojo-pizza' },
    { id: 'Sweets', name: 'Desi Desserts & Drinks', icon: '🍮', brandId: 'box8' },
  ];

  // Section Refs & Lock Flag for scroll sync & position alignment
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const sidebarItemRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const isManualClickRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Active brand info (when restaurant is selected)
  const activeBrand = initialBrandId ? brands.find((b) => b.id === initialBrandId) || null : null;

  const normalizeCategory = (cat?: string): string => {
    if (!cat) return allSidebarCategories[0].id;
    if (cat === 'Thalis') return 'Thali';
    const match = allSidebarCategories.find(
      (c) => c.id.toLowerCase() === cat.toLowerCase() || c.name.toLowerCase().includes(cat.toLowerCase())
    );
    return match ? match.id : allSidebarCategories[0].id;
  };

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [apiBrands, apiItems] = await Promise.all([
          api.getBrands().catch(() => null),
          api.getMenuItems().catch(() => null),
        ]);

        if (apiBrands && Array.isArray(apiBrands) && apiBrands.length > 0) {
          const mappedBrands: Brand[] = apiBrands.map((b: any) => {
            const fallback = MOCK_BRANDS.find((mb) => mb.id === b.slug || mb.id === b.id) || MOCK_BRANDS[0];
            return {
              id: b.slug || b.id,
              name: b.name,
              tagline: b.tagline || fallback.tagline,
              logo: b.logoUrl || fallback.logo,
              heroImage: b.heroImageUrl || fallback.heroImage,
              themeColor: fallback.themeColor || '#E11D48',
              rating: fallback.rating || 4.5,
              totalRatings: fallback.totalRatings || 2500,
              deliveryTimeMins: fallback.deliveryTimeMins || 20,
              minOrderValue: b.minOrderValue || 149,
              categories: b.cuisine || ['Popular'],
              isAvailable: b.isActive ?? true,
              isOwned: b.isOwned ?? fallback.isOwned ?? true,
              commissionPct: b.commissionPct ?? fallback.commissionPct,
            };
          });
          setBrands(mappedBrands);
        }

        if (apiItems && Array.isArray(apiItems) && apiItems.length > 0) {
          const mappedItems: MenuItem[] = apiItems.map((i: any) => ({
            id: i.id,
            brandId: i.brandKitchen?.brand?.slug || 'box8',
            availableHubIds: (i.brandKitchen?.brand?.brandKitchens ?? []).map((bk: { hubId: string }) => bk.hubId).filter(Boolean),
            name: i.name,
            description: i.description || i.name,
            mrp: Math.round((i.priceInPaise || 30000) / 100 * 1.3),
            memberPrice: Math.round((i.priceInPaise || 20000) / 100),
            image: i.image || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80',
            isVeg: i.isVeg ?? true,
            isBestseller: true,
            category: i.category || 'Popular',
            rating: 4.8,
            isAvailable: i.isAvailable ?? true,
          }));
          // Ensure mock items exist for every category alongside API items
          const existingIds = new Set(MOCK_MENU_ITEMS.map(item => item.id));
          const uniqueApiItems = mappedItems.filter(item => !existingIds.has(item.id));
          setMenuItems([...MOCK_MENU_ITEMS, ...uniqueApiItems]);
        }
      } catch (err) {
        console.warn('API error, falling back to mock menu items:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Precise Offset Scroll Handler for clean section top alignment
  const scrollToCategory = (catId: string, isSmooth = true) => {
    const targetEl = sectionRefs.current[catId];
    if (!targetEl) return;

    isManualClickRef.current = true;
    setSelectedCategory(catId);

    // Total Combined Sticky Height: Navbar (~88px) + Menu Explorer Ribbon (~68px) = ~156px
    const HEADER_OFFSET = 160;
    const elementPosition = targetEl.getBoundingClientRect().top;
    const offsetPosition = window.pageYOffset + elementPosition - HEADER_OFFSET;

    window.scrollTo({
      top: offsetPosition,
      behavior: isSmooth ? 'smooth' : 'auto',
    });

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isManualClickRef.current = false;
    }, 750);
  };

  // Initial Category Redirection Scroll (from "What's on your mind?" or restaurant click)
  useEffect(() => {
    // If a brand is selected without a specific category, pick its first category
    let catToSelect: string;
    if (initialBrandId && !initialCategory) {
      const firstBrandCat = allSidebarCategories.find((c) => {
        const items = MOCK_MENU_ITEMS.filter((item) => item.brandId === initialBrandId);
        return items.length > 0;
      });
      catToSelect = firstBrandCat ? firstBrandCat.id : allSidebarCategories[0].id;
    } else {
      catToSelect = normalizeCategory(initialCategory);
    }
    setSelectedCategory(catToSelect);

    const timer = setTimeout(() => {
      scrollToCategory(catToSelect, true);
    }, 300);

    return () => clearTimeout(timer);
  }, [initialCategory, initialBrandId]);

  // Bidirectional Scroll Synchronization: Right Scroll -> Left Highlight
  useEffect(() => {
    const handleScroll = () => {
      if (isManualClickRef.current) return;

      const HEADER_OFFSET = 170;
      let activeCat = '';

      sidebarCategories.forEach((cat) => {
        const el = sectionRefs.current[cat.id];
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= HEADER_OFFSET) {
            activeCat = cat.id;
          }
        }
      });

      if (activeCat && activeCat !== selectedCategory) {
        setSelectedCategory(activeCat);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [selectedCategory]);

  // Auto-scroll sidebar item into view when active category changes
  useEffect(() => {
    const activeBtn = sidebarItemRefs.current[selectedCategory];
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedCategory]);


  // Helper to filter items for a category section
  const getItemsForCategory = (catId: string) => {
    const catLower = catId.toLowerCase();
    return menuItems.filter((item) => {
      let matchesCategory = false;
      const itemCat = (item.category || '').toLowerCase();
      const itemBrand = (item.brandId || '').toLowerCase();

      if (catId === 'Pizza') {
        matchesCategory = itemCat.includes('pizza') || (itemBrand === 'mojo-pizza' && !itemCat.includes('wing'));
      } else if (catId === 'ThinCrust') {
        matchesCategory = itemCat.includes('thincrust') || itemCat.includes('thin crust') || itemBrand === 'leancrust';
      } else if (catId === 'Thali') {
        matchesCategory = itemCat.includes('thali') || (itemBrand === 'box8' && !itemCat.includes('sweet') && !itemCat.includes('dessert'));
      } else if (catId === 'Biryani') {
        matchesCategory = itemCat.includes('biryani') || itemBrand === 'zaza-biryani';
      } else if (catId === 'Bowl') {
        matchesCategory = itemCat.includes('bowl') || itemBrand === 'nh1-bowls';
      } else if (catId === 'High Protein') {
        matchesCategory = itemCat.includes('protein') || itemCat.includes('salad') || itemBrand === 'wefit';
      } else if (catId === 'Rolls') {
        matchesCategory = itemCat.includes('roll') || itemCat.includes('wrap') || itemBrand === 'mealful-rolls';
      } else if (catId === 'Sandwich') {
        matchesCategory = itemCat.includes('sandwich') || itemCat.includes('toast') || itemCat.includes('panini');
      } else if (catId === 'Chicken Wings') {
        matchesCategory = itemCat.includes('wing') || itemCat.includes('appetizer') || item.name.toLowerCase().includes('wing');
      } else if (catId === 'Sweets') {
        matchesCategory = itemCat.includes('sweet') || itemCat.includes('dessert') || itemCat.includes('halwa') || itemCat.includes('cake') || itemCat.includes('jamun');
      } else {
        matchesCategory = itemCat.includes(catLower) || item.name.toLowerCase().includes(catLower);
      }

      // When a specific restaurant is selected, restrict to that brand's items
      const matchesBrand = initialBrandId ? item.brandId === initialBrandId : true;

      let matchesDiet = true;
      if (dietFilter === 'VEG') matchesDiet = item.isVeg === true;
      if (dietFilter === 'NON_VEG') matchesDiet = item.isVeg === false;

      let matchesBestseller = true;
      if (bestsellerOnly) matchesBestseller = item.isBestseller === true;

      let matchesSearch = true;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        matchesSearch = item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      }

      return matchesCategory && matchesBrand && matchesDiet && matchesBestseller && matchesSearch;
    });
  };

  // Dynamically compute which categories have items (respecting brand filter)
  // When a brand is selected, only show categories that have items from that brand
  const sidebarCategories = allSidebarCategories.filter((cat) => {
    const items = getItemsForCategory(cat.id);
    return items.length > 0;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white pb-20">
      
      {/* Top Floating Filter & Search Header (STICKY DIRECTLY BELOW NAVBAR) */}
      <div className="sticky top-[88px] z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 shadow-xs py-3 px-4 sm:px-6 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Back & Breadcrumb Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                {activeBrand ? activeBrand.name : 'Menu Explorer'}
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                  Flat 30% OFF
                </span>
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {activeBrand ? activeBrand.tagline : '1 Cart • Multi-Brand Cloud Kitchen Menu'}
              </p>
            </div>
          </div>

          {/* Quick Dietary Filters & Search */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Veg Pill */}
            <button
              onClick={() => setDietFilter((prev) => (prev === 'VEG' ? 'ALL' : 'VEG'))}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 border transition-all ${
                dietFilter === 'VEG'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-emerald-500'
              }`}
            >
              <div className="w-3 h-3 rounded-xs border border-emerald-600 flex items-center justify-center p-0.5 bg-white">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              </div>
              <span>Veg Only</span>
            </button>

            {/* Non-Veg Pill */}
            <button
              onClick={() => setDietFilter((prev) => (prev === 'NON_VEG' ? 'ALL' : 'NON_VEG'))}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 border transition-all ${
                dietFilter === 'NON_VEG'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-rose-500'
              }`}
            >
              <div className="w-3 h-3 rounded-xs border border-rose-600 flex items-center justify-center p-0.5 bg-white">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              </div>
              <span>Non-Veg</span>
            </button>

            {/* Bestseller Filter */}
            <button
              onClick={() => setBestsellerOnly((prev) => !prev)}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 border transition-all ${
                bestsellerOnly
                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-amber-400'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${bestsellerOnly ? 'fill-white text-white' : 'text-amber-500'}`} />
              <span>Bestseller</span>
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-full text-xs bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-transparent focus:border-rose-500 focus:outline-none w-36 sm:w-44 focus:w-56 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* BRAND HERO BANNER — shown when a specific restaurant is selected */}
      {activeBrand && (
        <div className="relative w-full h-52 sm:h-72 overflow-hidden">
          <NextImage
            src={activeBrand.heroImage}
            alt={activeBrand.name}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-4 sm:left-8 flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-white bg-white p-0.5 shadow-lg flex items-center justify-center">
              <img src={activeBrand.logo} alt={activeBrand.name} className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-white font-extrabold text-lg sm:text-xl leading-tight">{activeBrand.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-black px-2 py-0.5 rounded">
                  <Star className="w-3 h-3 fill-white" />
                  {activeBrand.rating.toFixed(1)}
                </span>
                <span className="text-white/80 text-xs font-medium">{activeBrand.deliveryTimeMins} min delivery</span>
                <span className="text-white/80 text-xs font-medium">Min ₹{activeBrand.minOrderValue}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE HORIZONTAL CATEGORY SELECTOR STRIP (lg:hidden, STICKY BELOW MENU EXPLORER RIBBON) */}
      <div className="lg:hidden sticky top-[156px] z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 py-2.5 px-4 overflow-x-auto scrollbar-none flex items-center gap-2">
        {sidebarCategories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => scrollToCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                isSelected
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.id}</span>
            </button>
          );
        })}
      </div>

      {/* Main Container: Split Left Sidebar + Right Food Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        
        {/* LEFT STICKY CATEGORY SIDEBAR */}
        <aside className="w-64 shrink-0 hidden lg:block sticky top-[164px] h-[calc(100vh-180px)] overflow-y-auto pr-2 scrollbar-none space-y-0.5 border-r border-gray-200/80 dark:border-slate-800/80">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
            Menu Categories
          </div>

          {sidebarCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                ref={(el) => {
                  sidebarItemRefs.current[cat.id] = el;
                }}
                onClick={() => scrollToCategory(cat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between text-xs transition-all ${
                  isSelected
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-extrabold border-l-3 border-rose-600'
                    : 'text-gray-600 dark:text-slate-400 font-medium hover:bg-gray-100 dark:hover:bg-slate-900 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-sm shrink-0 opacity-90">{cat.icon}</span>
                  <span className="truncate">{cat.name}</span>
                </div>
              </button>
            );
          })}
        </aside>

        {/* RIGHT MAIN FOOD DISHES GRID */}
        <main className="flex-1 space-y-12">
          {sidebarCategories.map((cat) => {
            const categoryItems = getItemsForCategory(cat.id);
            const brandInfo = brands.find((b) => b.id === cat.brandId) || brands[0];

            // Skip any category with no items (applies for brand filter, search filter, etc.)
            if (categoryItems.length === 0) return null;

            return (
              <div
                key={cat.id}
                ref={(el) => {
                  sectionRefs.current[cat.id] = el;
                }}
                className="space-y-4 pt-2"
              >
                {/* Category Section Header */}
                <div className="border-b border-gray-200 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      Served fresh from <strong className="text-gray-800 dark:text-slate-200">{brandInfo.name}</strong> • {brandInfo.deliveryTimeMins} min delivery
                    </p>
                  </div>

                  <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                    {categoryItems.length} Items
                  </span>
                </div>

                {/* Items Grid */}
                {categoryItems.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 text-center border border-dashed border-gray-200 dark:border-slate-800 text-xs text-gray-400">
                    No items found matching the selected filters.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {categoryItems.map((item) => {
                      const isAdded = cartItems.some((ci) => ci.item.id === item.id);
                      return (
                        <div
                          key={item.id}
                          className="flex flex-col overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800 transition-all duration-200 hover:border-gray-300 dark:hover:border-slate-700"
                        >
                          {/* Item Image Banner */}
                          <div className="relative w-full h-44 overflow-hidden bg-gray-100 dark:bg-slate-800">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />

                            {/* Bestseller Badge */}
                            {item.isBestseller && (
                              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-sky-500 text-white text-[10px] font-bold tracking-wide shadow-xs">
                                Bestseller
                              </div>
                            )}

                            {/* Rating Tag */}
                            <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-white/90 dark:bg-slate-900/90 text-gray-800 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 shadow-xs border border-gray-200/50 dark:border-slate-700/50">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              <span>{item.rating}</span>
                            </div>
                          </div>

                          {/* Card Content Body */}
                          <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                {/* Veg / Non-Veg Tag */}
                                <div
                                  className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center border bg-white ${
                                    item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                                  }`}
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                                </div>
                                <h3 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white line-clamp-1">
                                  {item.name}
                                </h3>
                              </div>
                              <p className="text-[11px] text-gray-500 dark:text-slate-400 line-clamp-2 leading-snug">
                                {item.description}
                              </p>
                            </div>

                            {/* Pricing & Add Button */}
                            <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-slate-800/80">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                                    ₹{item.memberPrice}
                                  </span>
                                  {item.mrp > item.memberPrice && (
                                    <span className="ml-1.5 text-xs text-gray-400 line-through">
                                      ₹{item.mrp}
                                    </span>
                                  )}
                                </div>

                                {item.customizationGroups && item.customizationGroups.length > 0 ? (
                                  <button
                                    onClick={() => onOpenItemModal(item)}
                                    className="px-4 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 hover:border-gray-400 text-xs font-bold transition-colors"
                                  >
                                    ADD +
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => addToCart(item)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                      isAdded
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 border-gray-300 dark:border-slate-700 hover:border-gray-400'
                                    }`}
                                  >
                                    {isAdded ? 'ADDED' : 'ADD +'}
                                  </button>
                                )}
                              </div>

                              {/* Coupon Tag */}
                              <div className="px-2 py-1 rounded bg-teal-50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/40 text-[10px] font-medium text-teal-700 dark:text-teal-300 flex items-center justify-between">
                                <span>Get for ₹{Math.round(item.memberPrice * 0.85)} with code FIRST30</span>
                                <Info className="w-3 h-3 text-teal-500 shrink-0" />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </main>
      </div>
    </div>
  );
};

