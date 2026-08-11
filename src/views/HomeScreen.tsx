'use client';

import React, { useState, useEffect } from 'react';
import { MOCK_BRANDS, MOCK_MENU_ITEMS } from '../data/mockData';
import { BrandId, MenuItem, Brand } from '../types';
import { useCart } from '../context/CartContext';
import { SpotlightCard } from '../components/SpotlightCard';
import { SplitText } from '../components/SplitText';
import { api } from '../lib/api-client';
import { Sparkles, Clock, ShieldCheck, Plus, Check, Star, ArrowRight, Flame, Heart, Zap, Loader2, ChevronLeft, ChevronRight, Lock, Tag, Calendar } from 'lucide-react';
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

  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scrollOffers = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
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

  // Time-Bound & Day-Bound Real-time applicability checks
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0 = Sun, 3 = Wed

  const isHappyHoursActive = currentHour >= 16 && currentHour < 18;
  const isWednesdayActive = currentDay === 3;
  const isLateNightActive = currentHour >= 23 || currentHour < 3;

  const mindScrollRef = React.useRef<HTMLDivElement>(null);

  const whatsOnYourMindCategories = [
    { name: 'Pizza', image: '/offer-pizza.png' },
    { name: 'Rolls', image: '/cat-rolls.png' },
    { name: 'Biryani', image: '/offer-biryani.png' },
    { name: 'Sandwich', image: '/cat-sandwich.png' },
    { name: 'Bowl', image: '/cat-bowl.png' },
    { name: 'ThinCrust', image: '/cat-thincrust-pizza.png' },
    { name: 'Chicken Wings', image: '/cat-chicken-wings.png' },
    { name: 'High Protein', image: '/offer-guilt-free.png' },
    { name: 'Sweets', image: '/cat-sweets.png' },
    { name: 'Thali', image: '/offer-meals.png' },
  ];

  const topOffers = [
    {
      id: 'meals-99',
      type: 'category',
      categoryName: 'Thalis',
      title: 'MEALS',
      price: '₹99',
      priceColor: 'text-teal-600 dark:text-teal-400',
      image: '/offer-meals.png',
      isActive: true,
      bgClass: 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
    },
    {
      id: 'biryani-99',
      type: 'category',
      categoryName: 'Biryani',
      title: 'BIRYANI',
      price: '₹99',
      priceColor: 'text-teal-600 dark:text-teal-400',
      image: '/offer-biryani.png',
      isActive: true,
      bgClass: 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
    },
    {
      id: 'guilt-free',
      type: 'category',
      categoryName: 'High Protein',
      title: 'GUILT',
      price: 'FREE',
      priceColor: 'text-emerald-600 dark:text-emerald-400',
      image: '/offer-guilt-free.png',
      isActive: true,
      bgClass: 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
    },
    {
      id: 'pizzas-99',
      type: 'category',
      categoryName: 'Pizza',
      title: 'PIZZAS',
      price: '₹99',
      priceColor: 'text-teal-600 dark:text-teal-400',
      image: '/offer-pizza.png',
      isActive: true,
      bgClass: 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
    },
    {
      id: '1plus1-deals',
      type: 'deals',
      title: '1+1',
      price: 'DEALS',
      priceColor: 'text-teal-600 dark:text-teal-400',
      image: '/offer-deals.png',
      isActive: true,
      bgClass: 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
    },
    {
      id: 'wholesale-zulus',
      type: 'graphic',
      title: 'WHOLESALE',
      subtitle: "by zulu's pizza",
      isActive: true,
      bgClass: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900',
    },
    {
      id: 'happy-hours',
      type: 'time-bound',
      title: 'HAPPY HOURS',
      subtitle: '4-6 PM',
      badge: '50% OFF',
      image: '/offer-happy-hours.png',
      isActive: isHappyHoursActive,
      timeLockReason: '4-6 PM Only',
      bgClass: isHappyHoursActive
        ? 'bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 text-white border-indigo-500/40 shadow-lg shadow-indigo-500/20'
        : 'bg-slate-200 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400',
    },
    {
      id: 'bogo-wednesday',
      type: 'day-bound',
      title: 'BUY ONE GET ONE',
      subtitle: 'WEDNESDAY',
      image: '/offer-bogo-wednesday.png',
      isActive: isWednesdayActive,
      timeLockReason: 'Wednesdays Only',
      bgClass: isWednesdayActive
        ? 'bg-gradient-to-br from-rose-600 to-amber-500 text-white border-rose-400/40 shadow-lg shadow-rose-500/20'
        : 'bg-slate-200 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400',
    },
    {
      id: 'late-night',
      type: 'time-bound',
      title: 'LATE NIGHT',
      subtitle: '11 PM - 3 AM',
      badge: 'FLAT ₹100 OFF',
      image: '/offer-late-night.png',
      isActive: isLateNightActive,
      timeLockReason: '11 PM - 3 AM',
      bgClass: isLateNightActive
        ? 'bg-gradient-to-br from-purple-900 via-slate-900 to-slate-900 text-white border-purple-500/40 shadow-lg shadow-purple-500/20'
        : 'bg-slate-200 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400',
    },
  ];

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

      {/* TOP OFFERS TODAY CAROUSEL SECTION (PIXEL PERFECT EATCLUB COMPACT PILLS) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">Top offers today</h2>
          </div>

          {/* Left / Right Carousel Scroll Control Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scrollOffers('left')}
              className="w-7 h-7 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-gray-700 dark:text-slate-300 transition-colors shadow-xs"
              aria-label="Scroll Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollOffers('right')}
              className="w-7 h-7 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-gray-700 dark:text-slate-300 transition-colors shadow-xs"
              aria-label="Scroll Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Compact Offers Track */}
        <div
          ref={scrollRef}
          className="flex items-center gap-3 overflow-x-auto pb-3 pt-1 px-0.5 scrollbar-none scroll-smooth"
        >
          {topOffers.map((offer) => {
            return (
              <motion.div
                key={offer.id}
                whileHover={offer.isActive ? { y: -3, scale: 1.02 } : {}}
                whileTap={offer.isActive ? { scale: 0.97 } : {}}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => {
                  if (!offer.isActive) return;
                  if (offer.type === 'category' && offer.categoryName) {
                    setSelectedCategory(offer.categoryName);
                  } else {
                    onNavigate('deals');
                  }
                }}
                className={`relative w-28 sm:w-32 h-36 sm:h-40 shrink-0 rounded-2xl p-2.5 flex flex-col justify-between items-center text-center transition-all duration-200 group overflow-hidden ${offer.isActive
                    ? 'bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-gray-300 dark:hover:border-slate-700 cursor-pointer'
                    : 'bg-slate-200/90 dark:bg-slate-800/80 border border-slate-300/80 dark:border-slate-700/80 cursor-not-allowed shadow-none'
                  }`}
              >

                {/* Offer Card Content: Category Cards (Meals, Biryani, Guilt Free, Pizzas) */}
                {offer.type === 'category' && (
                  <div className={`w-full h-full flex flex-col justify-between items-center ${!offer.isActive ? 'grayscale opacity-60' : ''}`}>
                    <div className="pt-0.5 space-y-0 text-center">
                      <h3 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                        {offer.title}
                      </h3>
                      <div className={`text-base sm:text-lg font-black leading-tight ${offer.priceColor}`}>
                        {offer.price}
                      </div>
                    </div>

                    <div className="w-20 h-16 sm:w-24 sm:h-20 flex items-center justify-center overflow-hidden">
                      <img
                        src={offer.image}
                        alt={offer.title}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </div>
                )}

                {/* Offer Card Content: 1+1 Deals */}
                {offer.type === 'deals' && (
                  <div className={`w-full h-full flex flex-col justify-between items-center ${!offer.isActive ? 'grayscale opacity-60' : ''}`}>
                    <div className="pt-0.5 space-y-0 text-center">
                      <h3 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                        {offer.title}
                      </h3>
                      <div className="text-base sm:text-lg font-black text-teal-600 dark:text-teal-400 leading-tight">
                        {offer.price}
                      </div>
                    </div>

                    <div className="w-20 h-16 sm:w-24 sm:h-20 flex items-center justify-center overflow-hidden">
                      <img
                        src={offer.image}
                        alt={offer.title}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </div>
                )}

                {/* Offer Card Content: Graphic Wholesale Card */}
                {offer.type === 'graphic' && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2 rounded-xl bg-[#FFF8E7] dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 space-y-1">
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">WHOLESALE</span>
                    <span className="text-[9px] italic font-bold text-amber-900 dark:text-amber-300">by zulu's pizza</span>
                  </div>
                )}

                {/* Offer Card Content: Happy Hours (4-6 PM) */}
                {offer.id === 'happy-hours' && (
                  <div className={`w-full h-full flex flex-col justify-between items-center p-1 ${!offer.isActive ? 'grayscale opacity-60' : ''}`}>
                    <div className="space-y-0 pt-1 text-center">
                      <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        {offer.title}
                      </h3>
                      <div className="text-[9px] font-bold text-amber-500">
                        {offer.subtitle}
                      </div>
                    </div>

                    <div className="w-full h-16 flex items-center justify-center overflow-hidden rounded-xl">
                      <img
                        src={offer.image}
                        alt={offer.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <div className="w-full py-1 rounded-lg bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
                      {offer.badge}
                    </div>
                  </div>
                )}

                {/* Offer Card Content: Day-Bound BOGO Wednesday */}
                {offer.id === 'bogo-wednesday' && (
                  <div className={`w-full h-full flex flex-col justify-between items-center p-1 ${!offer.isActive ? 'grayscale opacity-60' : ''}`}>
                    <div className="pt-1 space-y-0 text-center">
                      <h3 className="text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        BUY ONE GET ONE
                      </h3>
                      <div className="text-[10px] font-black text-slate-800 dark:text-slate-100">
                        WEDNESDAY
                      </div>
                    </div>

                    <div className="w-full h-16 flex items-center justify-center overflow-hidden rounded-xl mb-6">
                      <img
                        src={offer.image}
                        alt={offer.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </div>
                )}

                {/* Offer Card Content: Late Night */}
                {offer.id === 'late-night' && (
                  <div className={`w-full h-full flex flex-col justify-between items-center p-1 ${!offer.isActive ? 'grayscale opacity-60' : ''}`}>
                    <div className="space-y-0 pt-1 text-center">
                      <h3 className="text-[11px] font-extrabold tracking-tight text-slate-700 dark:text-slate-200">{offer.title}</h3>
                      <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400">{offer.subtitle}</span>
                    </div>

                    <div className="w-full h-16 flex items-center justify-center overflow-hidden rounded-xl">
                      <img
                        src={offer.image}
                        alt={offer.title}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <div className="w-full py-1 rounded-lg bg-purple-700 text-white text-[9px] font-black uppercase">
                      {offer.badge}
                    </div>
                  </div>
                )}

              </motion.div>
            );
          })}
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

      {/* WHAT'S ON YOUR MIND? CATEGORY CAROUSEL (NO CARD BACKGROUNDS, PURE CUTOUTS) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              What's on your mind?
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => mindScrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' })}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center text-gray-700 dark:text-slate-300 transition-colors shadow-xs"
              aria-label="Scroll Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => mindScrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center text-gray-700 dark:text-slate-300 transition-colors shadow-xs"
              aria-label="Scroll Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={mindScrollRef}
          className="flex items-center gap-6 sm:gap-8 overflow-x-auto pb-3 pt-1 px-1 scrollbar-none scroll-smooth"
        >
          {whatsOnYourMindCategories.map((cat) => (
            <motion.div
              key={cat.name}
              whileHover={{ y: -3, scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory(cat.name)}
              className="flex flex-col items-center shrink-0 cursor-pointer group"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center p-1 bg-transparent">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-contain group-hover:scale-108 transition-transform duration-300 filter drop-shadow-sm"
                />
              </div>
              <span className="mt-2 text-xs sm:text-sm font-semibold text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors text-center whitespace-nowrap">
                {cat.name}
              </span>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};
