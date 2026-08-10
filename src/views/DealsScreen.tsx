'use client';

import React from 'react';
import { MOCK_COUPONS } from '../data/mockData';
import { Tag, Sparkles, Flame, Check, Copy } from 'lucide-react';

interface DealsScreenProps {
  onNavigate: (view: string) => void;
}

export const DealsScreen: React.FC<DealsScreenProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">Deals & Coupons</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400">Exclusive savings for Eatclub members on every order</p>
      </div>

      {/* Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 text-white shadow-lg space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold">
          <Flame className="w-4 h-4 text-amber-200" /> Happy Hours (4 PM - 6 PM)
        </div>
        <h2 className="text-2xl sm:text-3xl font-black">All Meals Starting @ ₹99</h2>
        <p className="text-xs text-rose-100 max-w-lg">
          No minimum order value. Enjoy BOX8 All-in-1 Meals, MOJO Personal Pizzas & ZAZA Biryani at ₹99 during Happy Hours!
        </p>
      </div>

      {/* Coupons List */}
      <div className="space-y-4">
        <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Active Promo Coupons</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MOCK_COUPONS.map((coupon) => (
            <div key={coupon.code} className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black text-xs">
                  {coupon.code}
                </span>
                <span className="text-[10px] text-gray-400">Min Order ₹{coupon.minOrderValue}</span>
              </div>
              <p className="text-xs font-bold text-gray-800 dark:text-slate-200">{coupon.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
