import React, { useState } from 'react';
import { Coupon, TabType } from '../types';

interface DealsScreenProps {
  coupons: Coupon[];
  onCopyCoupon: (code: string) => void;
  setActiveTab: (tab: TabType) => void;
}

export const DealsScreen: React.FC<DealsScreenProps> = ({
  coupons,
  onCopyCoupon,
  setActiveTab,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All Passes' },
    { id: 'first_order', label: 'First Order' },
    { id: 'brand_exclusive', label: 'Kitchen Exclusive' },
    { id: 'bestseller', label: 'Mega Savers' },
    { id: 'late_night', label: 'Late Night' },
  ];

  const filteredCoupons = selectedCategory === 'all'
    ? coupons
    : coupons.filter(c => c.category === selectedCategory);

  const handleCopy = (code: string) => {
    setCopiedCode(code);
    onCopyCoupon(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 text-[#FDFCF5]">
      {/* Deals Header Banner */}
      <section className="relative rounded-2xl overflow-hidden bg-[#161616] border border-white/10 text-[#FDFCF5] p-6 sm:p-10 shadow-xl">
        <div className="max-w-md space-y-4 relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-[#C5A059] text-[#0F0F0F] font-bold text-[10px] uppercase tracking-[0.2em] px-3.5 py-1 rounded-full shadow-md">
            <span className="material-symbols-outlined text-xs">local_offer</span>
            <span>Exclusive Culinary Vouchers</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif-display font-medium tracking-tight text-[#FDFCF5]">
            Privileged Savings On Every Course
          </h1>
          <p className="text-xs text-white/70 leading-relaxed font-light">
            Apply verified gallery passes at checkout for zero markup rates, complimentary signature dishes, and flat discounts.
          </p>
        </div>

        {/* Banner Graphic */}
        <div className="absolute right-4 bottom-0 top-0 w-1/3 hidden sm:flex items-center justify-end pointer-events-none opacity-60">
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9pDCa6s5l5TQ9_fWlmWBeaySOZRdreUqwggnWG66FDrIMpQheihOeI8VADp_k2nEr_30pquvVyoxpyRaRiVsCQSdb58RR49ULDwSTbNPxWGZyLhUcB4g0Q3P_7aKqJGEujL0tWCPzbWCmOk_wcCz94hIsGTzgdr9JmGDRxSoh7pP9IY50f7EtkVcSTNbL104Zg4LeXerLXBbbRboqIapn-s2BX9Zuqb1xMf-tfNwOOxZWGMMhhSmD4A" 
            alt="Feast Banner" 
            className="h-44 object-contain filter drop-shadow-md"
          />
        </div>
      </section>

      {/* Offer Categories Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-[#C5A059] text-[#0F0F0F] shadow-md'
                : 'bg-[#181818] text-white/70 border border-white/10 hover:bg-white/5'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredCoupons.map((coupon) => {
          const isCopied = copiedCode === coupon.code;
          return (
            <div
              key={coupon.id}
              className="bg-[#181818] rounded-xl border border-white/10 p-5 shadow-md hover:border-[#C5A059]/50 transition-all flex flex-col justify-between relative overflow-hidden group"
            >
              {/* Left Accent Bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#C5A059]" />

              <div className="space-y-3 pl-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#C5A059] tracking-[0.2em]">
                      {coupon.validOn}
                    </span>
                    <h3 className="text-base font-serif-display font-semibold text-[#FDFCF5] mt-0.5">
                      {coupon.title}
                    </h3>
                  </div>

                  <div className="bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#C5A059] text-xs font-mono font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 shrink-0">
                    <span className="material-symbols-outlined text-sm text-[#C5A059]">confirmation_number</span>
                    <span>{coupon.code}</span>
                  </div>
                </div>

                <p className="text-xs text-white/60 leading-relaxed font-light">
                  {coupon.description}
                </p>
              </div>

              {/* Card Footer Action */}
              <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between pl-2">
                <span className="text-[11px] font-light text-white/40">
                  {coupon.minOrder ? `Min order ₹${coupon.minOrder}` : 'No min order required'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(coupon.code)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/10 hover:bg-[#C5A059] text-[#FDFCF5] hover:text-[#0F0F0F]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {isCopied ? 'check' : 'content_copy'}
                    </span>
                    <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('home')}
                    className="bg-[#C5A059] text-[#0F0F0F] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#d8b268] transition-colors shadow-sm"
                  >
                    Explore
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

