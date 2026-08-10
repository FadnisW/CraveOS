import React from 'react';
import { TabType, Address } from '../types';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  selectedAddress: Address;
  onOpenAddressModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  cartTotal,
  onOpenCart,
  selectedAddress,
  onOpenAddressModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Location */}
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2 focus:outline-hidden group text-left"
          >
            <span className="text-2xl sm:text-3xl font-serif-display font-semibold tracking-tight text-[#FDFCF5]">
              Eat<span className="text-[#C5A059] italic font-serif">Club</span>
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C5A059] group-hover:scale-150 transition-transform"></span>
          </button>

          {/* Deliver To Selector */}
          <button
            onClick={onOpenAddressModal}
            className="hidden sm:flex items-center gap-2 py-1.5 px-3.5 rounded-full bg-[#1A1A1A] hover:bg-[#222222] border border-white/10 text-xs font-medium text-white/80 transition-all hover:border-[#C5A059]/40"
          >
            <span className="material-symbols-outlined text-[#C5A059] text-lg">location_on</span>
            <div className="text-left max-w-[160px] truncate">
              <span className="font-semibold text-[#FDFCF5] block text-[12px]">{selectedAddress.label}</span>
              <span className="text-white/50 text-[10px] uppercase tracking-wider truncate block">{selectedAddress.addressLine1}</span>
            </div>
            <span className="material-symbols-outlined text-white/40 text-sm">keyboard_arrow_down</span>
          </button>
        </div>

        {/* Center: Quick Search Bar for Desktop */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <button
            onClick={() => setActiveTab('search')}
            className="w-full flex items-center gap-3 bg-[#1A1A1A] hover:bg-[#222222] text-white/50 text-xs tracking-wide uppercase px-4 py-2.5 rounded-full border border-white/10 hover:border-[#C5A059]/30 transition-all text-left"
          >
            <span className="material-symbols-outlined text-[#C5A059] text-lg">search</span>
            <span>Search for gourmet, artisan pizza, or bowls...</span>
          </button>
        </div>

        {/* Right: Nav Actions & Cart */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => setActiveTab('deals')}
              className={`px-3.5 py-1.5 rounded-full text-xs uppercase tracking-widest font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'deals' ? 'text-[#C5A059] bg-[#C5A059]/15 border border-[#C5A059]/30' : 'text-white/70 hover:text-[#FDFCF5] hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">local_offer</span>
              Deals
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3.5 py-1.5 rounded-full text-xs uppercase tracking-widest font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'orders' ? 'text-[#C5A059] bg-[#C5A059]/15 border border-[#C5A059]/30' : 'text-white/70 hover:text-[#FDFCF5] hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">receipt_long</span>
              Orders
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-1.5 rounded-full text-xs uppercase tracking-widest font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'profile' ? 'text-[#C5A059] bg-[#C5A059]/15 border border-[#C5A059]/30' : 'text-white/70 hover:text-[#FDFCF5] hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">person</span>
              Profile
            </button>
          </nav>

          {/* Search Trigger for Mobile */}
          <button
            onClick={() => setActiveTab('search')}
            className="md:hidden p-2 rounded-full text-white/80 hover:bg-white/10"
            aria-label="Search"
          >
            <span className="material-symbols-outlined text-2xl">search</span>
          </button>

          {/* Cart Button */}
          <button
            onClick={onOpenCart}
            className="flex items-center gap-2.5 bg-[#C5A059] hover:bg-[#d8b268] text-[#0F0F0F] px-4 sm:px-5 py-2 rounded-full font-bold text-xs sm:text-sm tracking-wide transition-all transform active:scale-95 shadow-[0_0_15px_rgba(197,160,89,0.25)]"
          >
            <div className="relative flex items-center">
              <span className="material-symbols-outlined text-xl">shopping_bag</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#0F0F0F] text-[#C5A059] border border-[#C5A059] text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="hidden sm:inline uppercase text-[11px] font-bold tracking-widest">Cart</span>
            {cartCount > 0 && (
              <span className="bg-[#0F0F0F]/20 px-2 py-0.5 rounded-full text-xs font-bold">
                ₹{cartTotal.toFixed(0)}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

