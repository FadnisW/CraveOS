'use client';

import React, { useState, useEffect } from 'react';
import { MOCK_BRANDS, MOCK_MENU_ITEMS } from '../data/mockData';
import { BrandId, MenuItem, Brand } from '../types';
import { useCart } from '../context/CartContext';
import { SpotlightCard } from '../components/SpotlightCard';
import { SplitText } from '../components/SplitText';
import { api } from '../lib/api-client';
import { Sparkles, Clock, ShieldCheck, Plus, Check, Star, ArrowRight, Flame, Heart, Zap, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface HomeScreenProps {
  onSelectBrand: (brandId: BrandId) => void;
  onOpenItemModal: (item: MenuItem) => void;
  onNavigate: (view: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectBrand,
  onOpenItemModal,
  onNavigate,
}) => {
  const { addToCart, cartItems } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [savingsOrdersPerMonth, setSavingsOrdersPerMonth] = useState<number>(4);
  const [brands, setBrands] = useState<Brand[]>(MOCK_BRANDS);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MOCK_MENU_ITEMS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [apiBrands, apiItems] = await Promise.all([
          api.getBrands().catch(() => null),
          api.getMenuItems().catch(() => null),
        ]);

        if (apiBrands && Array.isArray(apiBrands) && apiBrands.length > 0) {
          const mappedBrands: Brand[] = apiBrands.map((b: any) => ({
            id: b.slug || b.id,
            name: b.name,
            tagline: b.cuisine?.join(', ') || 'Desi Meals & Specialties',
            logo: b.logoUrl || MOCK_BRANDS[0].logo,
            heroImage: b.logoUrl || MOCK_BRANDS[0].heroImage,
            themeColor: '#E11D48',
            rating: 4.6,
            totalRatings: 12000,
            deliveryTimeMins: 22,
            minOrderValue: 149,
            categories: b.cuisine || ['Popular'],
            isAvailable: b.isActive ?? true,
          }));
          setBrands(mappedBrands);
        }

        if (apiItems && Array.isArray(apiItems) && apiItems.length > 0) {
          const mappedItems: MenuItem[] = apiItems.map((i: any) => ({
            id: i.id,
            brandId: i.brandKitchen?.brand?.slug || 'box8',
            name: i.name,
            description: i.description || i.name,
            mrp: Math.round((i.priceInPaise || 30000) / 100 * 1.3),
            memberPrice: Math.round((i.priceInPaise || 20000) / 100),
            image: i.image || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80',
            isVeg: i.isVeg ?? true,
            isBestseller: true,
            category: i.category || 'Popular',
            rating: 4.7,
            isAvailable: i.isAvailable ?? true,
          }));
          setMenuItems(mappedItems);
        }
      } catch (err) {
        console.warn('API connection failed, falling back to mock data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const categories = ['All', 'Pizza', 'Biryani', 'Thalis', 'High Protein', 'Rolls', 'Desserts'];

  const filteredItems = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter((item) => {
        if (selectedCategory === 'Pizza') return item.brandId === 'mojo-pizza' || item.brandId === 'leancrust';
        if (selectedCategory === 'Biryani') return item.brandId === 'zaza-biryani';
        if (selectedCategory === 'Thalis') return item.brandId === 'box8';
        if (selectedCategory === 'High Protein') return item.brandId === 'wefit';
        return item.category.toLowerCase().includes(selectedCategory.toLowerCase());
      });

  const avgOrderVal = 350;
  const memberDiscountPerOrder = avgOrderVal * 0.3;
  const deliverySavedPerOrder = 45;
  const packagingSavedPerOrder = 25;
  const totalSavedPerOrder = memberDiscountPerOrder + deliverySavedPerOrder + packagingSavedPerOrder;
  const annualSavings = Math.round(totalSavedPerOrder * savingsOrdersPerMonth * 12);

  return (
    <div className="space-y-10 pb-16">
      
      {/* HERO SECTION: Time-Bound Deal Ticker & Animated Carousel */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-rose-500 to-amber-500 text-white p-6 sm:p-10 shadow-xl shadow-rose-500/15">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold tracking-wide uppercase">
              <Flame className="w-4 h-4 text-amber-300 animate-bounce" />
              <span>Happy Hours Live • Daily 4 PM - 6 PM</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              <SplitText text="Order from 8 Brands in 1 Single Cart!" delay={0.03} />
            </h1>

            <p className="text-sm sm:text-base text-rose-50 max-w-xl font-medium">
              Mix MOJO Pizza, BOX8 Thalis, ZAZA Biryani & WeFit Bowls in one delivery trip with <strong>₹0 Delivery Fee</strong> and <strong>Flat 30% Member Discounts</strong>!
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => onNavigate('deals')}
                className="px-6 py-3 rounded-2xl bg-white text-rose-600 font-extrabold text-sm hover:bg-rose-50 shadow-lg shadow-black/10 transition-all duration-200 flex items-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                Explore Deals @ ₹99
              </button>
              
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-100">
                <Clock className="w-4 h-4" />
                <span>Avg Delivery: <strong>22 Mins</strong></span>
              </div>
            </div>
          </div>

          {/* Hero Spotlight Card */}
          <div className="lg:col-span-5 relative">
            <div className="rounded-2xl overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 p-4 space-y-3">
              <div className="relative h-48 rounded-xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80"
                  alt="MOJO Pizza Special"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 text-white">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Meal of the Day</span>
                  <h3 className="text-lg font-bold">MOJO 2X Loaded 10" Pizza</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs line-through opacity-70">₹499</span>
                    <span className="text-base font-extrabold text-emerald-300">₹249 for Members</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* MULTI-BRAND STOREFRONT SPOTLIGHT GRID */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Our In-House Cloud Kitchen Brands</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">All brands are cooked fresh and dispatched together from your local hub</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {brands.map((brand) => (
            <SpotlightCard
              key={brand.id}
              onClick={() => onSelectBrand(brand.id)}
              spotlightColor="rgba(225, 29, 72, 0.2)"
              className="cursor-pointer group shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="relative h-32 overflow-hidden">
                <img
                  src={brand.heroImage}
                  alt={brand.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>{brand.rating}</span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-semibold">
                  <span>{brand.deliveryTimeMins} mins</span>
                  <span className="text-emerald-300 font-bold">₹0 Delivery</span>
                </div>
              </div>

              <div className="p-4 space-y-1">
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                  {brand.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                  {brand.tagline}
                </p>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* INTERACTIVE MEMBERSHIP SAVINGS CALCULATOR WIDGET */}
      <section className="rounded-3xl bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 text-white p-6 sm:p-8 border border-emerald-500/20 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-7 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Eatclub Membership Guarantee</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              See How Much You Save Every Month
            </h2>

            <p className="text-xs sm:text-sm text-slate-300">
              Members get a flat 30% discount on all dishes + ₹0 delivery fee + ₹0 packaging fee across all 8 cloud kitchen brands.
            </p>

            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Orders per month: <strong className="text-emerald-400 text-sm">{savingsOrdersPerMonth} orders</strong></span>
                <span>Avg Order Value: ₹{avgOrderVal}</span>
              </div>

              <input
                type="range"
                min="1"
                max="10"
                value={savingsOrdersPerMonth}
                onChange={(e) => setSavingsOrdersPerMonth(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </div>

          <div className="lg:col-span-5 bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Estimated Annual Savings</span>
            <div className="text-4xl sm:text-5xl font-black text-emerald-400">
              ₹{annualSavings.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-slate-300">
              Free 3-Month Trial Included with Your First Order!
            </p>
            <button
              onClick={() => onNavigate('deals')}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition-colors"
            >
              Start Free Membership Trial
            </button>
          </div>

        </div>
      </section>

      {/* DISHES & QUICK ADD GRID */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Recommended Dishes For You</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">Handpicked bestseller meals across our cloud kitchens</p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                  selectedCategory === cat
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Item Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const isAdded = cartItems.some((ci) => ci.item.id === item.id);
            return (
              <SpotlightCard
                key={item.id}
                spotlightColor="rgba(225, 29, 72, 0.12)"
                className="flex flex-col overflow-hidden rounded-2xl transition-all duration-200 group border border-gray-200/80 dark:border-slate-800"
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
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      {item.brandId.toUpperCase()}
                    </span>
                    <h3 className="font-extrabold text-base text-gray-900 dark:text-white line-clamp-1 group-hover:text-rose-600 transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800/80">
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
              </SpotlightCard>
            );
          })}
        </div>
      </section>

    </div>
  );
};
