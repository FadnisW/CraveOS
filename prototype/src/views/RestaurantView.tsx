import React, { useState } from 'react';
import { Restaurant, FoodItem, TabType } from '../types';

interface RestaurantViewProps {
  restaurant: Restaurant;
  foodItems: FoodItem[];
  onSelectItem: (item: FoodItem) => void;
  onBack: () => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
}

export const RestaurantView: React.FC<RestaurantViewProps> = ({
  restaurant,
  foodItems,
  onSelectItem,
  onBack,
  cartCount,
  cartTotal,
  onOpenCart,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isVegOnly, setIsVegOnly] = useState<boolean>(false);

  const restaurantItems = foodItems.filter(item => item.restaurantId === restaurant.id || activeCategory === 'All');

  const categories = ['All', ...Array.from(new Set(restaurantItems.map(i => i.category)))];

  const filteredItems = restaurantItems.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesVeg = !isVegOnly || item.isVeg;
    return matchesCategory && matchesVeg;
  });

  return (
    <div className="space-y-6 pb-24 text-[#FDFCF5]">
      {/* Back Header */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#C5A059] bg-[#181818] border border-white/10 px-4 py-2 rounded-full shadow-md hover:bg-white/5 transition-colors"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        <span>Back to Kitchens</span>
      </button>

      {/* Restaurant Header Banner */}
      <div className="bg-[#181818] rounded-2xl border border-white/10 overflow-hidden shadow-xl flex flex-col md:flex-row">
        <div className="relative h-48 md:h-auto md:w-80 shrink-0 bg-[#101010]">
          <img 
            src={restaurant.image} 
            alt={restaurant.name} 
            className="w-full h-full object-cover"
          />
          {restaurant.rating && (
            <div className="absolute top-3 left-3 bg-[#0F0F0F]/80 text-[#FDFCF5] border border-white/10 text-xs font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 backdrop-blur-md">
              <span className="text-[#C5A059]">★</span>
              <span>{restaurant.rating}</span>
            </div>
          )}
        </div>

        <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#C5A059] text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                {restaurant.cuisine.join(' • ')}
              </span>
              {restaurant.discountText && (
                <span className="bg-[#C5A059] text-[#0F0F0F] text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm">
                  {restaurant.discountText}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-serif-display font-semibold text-[#FDFCF5]">{restaurant.name}</h1>
            <p className="text-xs text-white/60 mt-1 font-light leading-relaxed">{restaurant.tagline}</p>
          </div>

          <div className="flex items-center gap-6 text-xs font-medium text-white/70 pt-3 border-t border-white/10">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#C5A059]">schedule</span>
              <span>{restaurant.deliveryTime || '25 mins'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#C5A059]">local_shipping</span>
              <span>Complimentary Delivery</span>
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Category Bar */}
      <div className="sticky top-16 z-30 bg-[#121212]/95 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-lg flex items-center justify-between gap-3 overflow-x-auto no-scrollbar scrollbar-hide">
        {/* Categories */}
        <div className="flex items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-[#C5A059] text-[#0F0F0F]'
                  : 'bg-[#181818] text-white/70 border border-white/10 hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Veg Only Toggle Switch */}
        <button
          onClick={() => setIsVegOnly(!isVegOnly)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0 border uppercase tracking-wider ${
            isVegOnly 
              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' 
              : 'bg-[#181818] border-white/10 text-white/70'
          }`}
        >
          <span className={`w-3 h-3 rounded-xs border flex items-center justify-center ${
            isVegOnly ? 'border-emerald-500 bg-emerald-500' : 'border-white/40'
          }`}>
            {isVegOnly && <span className="w-1.5 h-1.5 rounded-full bg-[#0F0F0F]" />}
          </span>
          <span>Veg Only</span>
        </button>
      </div>

      {/* Food Items List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-[#181818] p-4 rounded-xl border border-white/10 shadow-md hover:border-[#C5A059]/40 transition-all flex items-start justify-between gap-4"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center shrink-0 ${
                  item.isVeg ? 'border-emerald-500' : 'border-rose-500'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                  }`} />
                </span>
                {item.isBestseller && (
                  <span className="text-[9px] font-bold text-[#C5A059] uppercase bg-[#C5A059]/20 border border-[#C5A059]/30 px-1.5 py-0.5 rounded-xs tracking-wider">
                    ★ BESTSELLER
                  </span>
                )}
              </div>

              <h3 className="text-sm font-bold text-[#FDFCF5]">{item.name}</h3>
              <p className="text-xs text-white/50 line-clamp-2 leading-relaxed font-light">{item.description}</p>
              
              <div className="flex items-baseline gap-2 pt-2">
                <span className="text-sm font-serif font-bold text-[#C5A059]">₹{item.price}</span>
                {item.originalPrice && (
                  <span className="text-xs text-white/30 line-through">₹{item.originalPrice}</span>
                )}
              </div>
            </div>

            <div className="relative shrink-0 flex flex-col items-center">
              <img 
                src={item.image} 
                alt={item.name} 
                className="w-24 h-24 rounded-xl object-cover border border-white/10"
              />
              <button
                onClick={() => onSelectItem(item)}
                className="absolute -bottom-3 bg-[#C5A059] text-[#0F0F0F] hover:bg-[#d8b268] font-bold text-[11px] px-4 py-1.5 rounded-full shadow-md transition-all uppercase tracking-wider"
              >
                + ADD
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Bottom Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-16 md:bottom-6 left-4 right-4 max-w-xl mx-auto z-40">
          <button
            onClick={onOpenCart}
            className="w-full bg-[#1A1A1A] text-[#FDFCF5] p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-[#C5A059]/50 animate-in fade-in slide-in-from-bottom duration-300 hover:bg-[#222222] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#C5A059] text-[#0F0F0F] flex items-center justify-center font-bold text-sm shadow-md">
                {cartCount}
              </div>
              <div className="text-left">
                <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Selection Total</div>
                <div className="text-base font-serif font-bold text-[#C5A059]">₹{cartTotal.toFixed(0)}</div>
              </div>
            </div>

            <div className="flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-[#C5A059]">
              <span>Review Selection</span>
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

