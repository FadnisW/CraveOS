import React, { useState } from 'react';
import { Restaurant, FoodItem, Offer, TabType } from '../types';

interface HomeScreenProps {
  restaurants: Restaurant[];
  topOffers: Offer[];
  bestsellers: FoodItem[];
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onSelectItem: (item: FoodItem) => void;
  setActiveTab: (tab: TabType) => void;
  onCopyCoupon: (code: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  restaurants,
  topOffers,
  bestsellers,
  onSelectRestaurant,
  onSelectItem,
  setActiveTab,
  onCopyCoupon,
}) => {
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('All');

  const filteredRestaurants = selectedBrandFilter === 'All'
    ? restaurants
    : restaurants.filter(r => r.name.toLowerCase().includes(selectedBrandFilter.toLowerCase()));

  return (
    <div className="space-y-10 pb-12">
      {/* Main Promo Hero Banner */}
      <section className="relative rounded-2xl overflow-hidden bg-[#161616] border border-white/10 text-[#FDFCF5] shadow-2xl">
        <div className="relative z-10 p-6 sm:p-10 md:p-12 max-w-xl space-y-5">
          <div className="inline-flex items-center gap-2 bg-[#C5A059] text-[#0F0F0F] font-bold text-[10px] uppercase tracking-[0.2em] px-3.5 py-1 rounded-full shadow-md">
            <span className="material-symbols-outlined text-sm">bolt</span>
            <span>First Order Exhibition</span>
          </div>
          
          <h1 className="text-2xl sm:text-4xl font-serif-display font-medium tracking-tight leading-tight text-[#FDFCF5]">
            Artisanal Culinary Meals at <span className="italic font-serif text-[#C5A059]">Zero Markups</span>
          </h1>

          <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-md font-light">
            Receive 3 complimentary signature items or 50% OFF on your initial 3 orders across BOX8, LeanCrust, ZAZA, and more.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => {
                onCopyCoupon('FIRST3');
                setActiveTab('deals');
              }}
              className="bg-[#C5A059] text-[#0F0F0F] hover:bg-[#d8b268] px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest shadow-md transition-all flex items-center gap-2"
            >
              <span>Code: <strong>FIRST3</strong></span>
              <span className="material-symbols-outlined text-sm">content_copy</span>
            </button>
            <button
              onClick={() => setActiveTab('deals')}
              className="text-[#FDFCF5] border border-white/20 hover:bg-white/10 px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest transition-colors"
            >
              Explore Passes →
            </button>
          </div>
        </div>

        {/* Hero Background Image */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 hidden md:block opacity-60 overflow-hidden">
          <img 
            src="https://lh3.googleusercontent.com/aida/AP1WRLssMMDduEze4z_3PXPC0wCvd2E7lupYsME2FOJnWEw74X9n_N8uqamO7W8AMyqmdGneMvr2tPrHHjFi7bwnd_3jPcY0jn_KHh7mBrQXYFM3q6gSkJVaV1ewZP7DKi2AZMiM4-HQQ3TfLfGx4KZHI7gu2EXdvQja7FxcnimamSO5LfAleC45NBPeLpCwFxE7PVaC8dUrP2ookDAUgONM0lyqjF-E-HlZvIPQd2-e8xwwgYBOnb8zP3q8_w" 
            alt="Delicious Feast"
            className="w-full h-full object-cover object-left rounded-l-2xl filter brightness-90 hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#161616] via-[#161616]/70 to-transparent"></div>
        </div>
      </section>

      {/* Top Offers Carousel */}
      <section className="space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-serif-display font-semibold text-[#FDFCF5] tracking-tight">Curated Daily Offers</h2>
            <p className="text-xs text-white/50 font-light">Exclusive gallery menus starting at ₹99</p>
          </div>
          <button 
            onClick={() => setActiveTab('deals')}
            className="text-xs font-bold uppercase tracking-widest text-[#C5A059] hover:underline flex items-center gap-1"
          >
            <span>View All Passes</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {topOffers.map((offer) => (
            <div
              key={offer.id}
              onClick={() => setActiveTab('deals')}
              className="group relative rounded-xl overflow-hidden bg-[#181818] border border-white/10 text-white cursor-pointer shadow-lg hover:border-[#C5A059]/50 transition-all duration-300 h-36 flex items-center justify-between p-5"
            >
              <div className="relative z-10 space-y-1">
                <span className="text-[10px] font-bold tracking-[0.3em] text-[#C5A059] uppercase">CURATED OFFER</span>
                <h3 className="text-lg font-serif-display font-semibold uppercase tracking-wider">{offer.title}</h3>
                <div className="inline-block bg-[#C5A059] text-[#0F0F0F] font-bold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full shadow-xs">
                  STARTS AT {offer.priceText}
                </div>
              </div>

              <div className="w-28 h-28 rounded-full overflow-hidden shrink-0 border border-white/20 group-hover:scale-105 transition-transform duration-500">
                <img 
                  src={offer.image} 
                  alt={offer.title}
                  className="w-full h-full object-cover" 
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Brand Filters */}
      <section className="space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-lg sm:text-xl font-serif-display font-semibold text-[#FDFCF5] tracking-tight">Artisan Cloud Kitchens</h2>
          <span className="text-xs text-white/40 font-light">{filteredRestaurants.length} brands in collection</span>
        </div>

        {/* Brand Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
          {['All', 'BOX8', 'LeanCrust', 'ZAZA', 'WeFit', 'Zulu'].map((brand) => {
            const isSelected = selectedBrandFilter === brand;
            return (
              <button
                key={brand}
                onClick={() => setSelectedBrandFilter(brand)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#C5A059] text-[#0F0F0F] shadow-md scale-105'
                    : 'bg-[#181818] text-white/70 border border-white/10 hover:border-white/30 hover:bg-white/5'
                }`}
              >
                {brand === 'All' ? 'All Kitchens' : brand}
              </button>
            );
          })}
        </div>

        {/* Restaurants Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRestaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              onClick={() => onSelectRestaurant(restaurant)}
              className="bg-[#181818] rounded-2xl border border-white/10 overflow-hidden shadow-lg hover:border-[#C5A059]/40 transition-all duration-300 cursor-pointer group flex flex-col"
            >
              {/* Restaurant Image */}
              <div className="relative h-44 overflow-hidden bg-[#101010]">
                <img 
                  src={restaurant.image} 
                  alt={restaurant.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent opacity-80" />
                
                {restaurant.discountText && (
                  <div className="absolute bottom-3 left-3 bg-[#C5A059] text-[#0F0F0F] text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">local_offer</span>
                    <span>{restaurant.discountText}</span>
                  </div>
                )}

                {restaurant.rating && (
                  <div className="absolute top-3 right-3 bg-[#0F0F0F]/80 text-[#FDFCF5] border border-white/10 text-xs font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 backdrop-blur-md">
                    <span className="text-[#C5A059]">★</span>
                    <span>{restaurant.rating}</span>
                  </div>
                )}
              </div>

              {/* Info Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-serif-display font-semibold text-base text-[#FDFCF5] group-hover:text-[#C5A059] transition-colors">
                    {restaurant.name}
                  </h3>
                  <p className="text-xs text-white/50 line-clamp-1 mt-0.5 font-light">
                    {restaurant.tagline}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-white/60 pt-2 border-t border-white/10">
                  <span className="flex items-center gap-1 font-medium text-white/80">
                    <span className="material-symbols-outlined text-base text-[#C5A059]">schedule</span>
                    {restaurant.deliveryTime}
                  </span>
                  <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider">
                    {restaurant.cuisine.join(' • ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bestsellers Section */}
      <section className="space-y-5 pt-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-serif-display font-semibold text-[#FDFCF5] tracking-tight">Bestselling Creations</h2>
            <p className="text-xs text-white/50 font-light">Most ordered dishes in the gallery</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bestsellers.map((item) => (
            <div
              key={item.id}
              className="bg-[#181818] p-3.5 rounded-xl border border-white/10 shadow-md hover:border-[#C5A059]/40 transition-all flex items-center gap-3"
            >
              <img 
                src={item.image} 
                alt={item.name} 
                className="w-20 h-20 rounded-lg object-cover shrink-0 border border-white/10"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-xs border flex items-center justify-center shrink-0 ${
                    item.isVeg ? 'border-emerald-500' : 'border-rose-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                    }`} />
                  </span>
                  <h4 className="text-xs font-bold text-[#FDFCF5] truncate">{item.name}</h4>
                </div>
                <p className="text-[11px] text-white/50 line-clamp-1 mt-0.5 font-light">{item.description}</p>
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-serif font-bold text-[#C5A059]">₹{item.price}</span>
                    {item.originalPrice && (
                      <span className="text-[10px] text-white/30 line-through">₹{item.originalPrice}</span>
                    )}
                  </div>

                  <button
                    onClick={() => onSelectItem(item)}
                    className="bg-[#C5A059]/15 border border-[#C5A059]/40 hover:bg-[#C5A059] text-[#C5A059] hover:text-[#0F0F0F] px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all"
                  >
                    + ADD
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

