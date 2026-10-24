'use client';

import React, { useState } from 'react';
import { Sparkles, Check, Zap, ShieldCheck, ArrowLeft, TrendingUp, Calculator, Gift, Star } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { motion } from 'motion/react';

interface MembershipScreenProps {
  onBack: () => void;
  onOpenAuthModal?: () => void;
}

export const MembershipScreen: React.FC<MembershipScreenProps> = ({ onBack, onOpenAuthModal }) => {
  const { user, isAuthenticated } = useUser();
  const [selectedPlan, setSelectedPlan] = useState<'trial' | 'quarterly' | 'annual'>('annual');
  const [monthlyOrders, setMonthlyOrders] = useState<number>(6);

  // Financial calculations
  const discountPerOrder = 120; // 30% off average ₹400 meal
  const deliverySavingsPerOrder = 45; // ₹45 delivery fee waived
  const packagingSavingsPerOrder = 25; // ₹25 packaging fee waived
  const savingsPerOrder = discountPerOrder + deliverySavingsPerOrder + packagingSavingsPerOrder; // ₹190

  const totalMonthlySavings = monthlyOrders * savingsPerOrder;
  const totalYearlySavings = totalMonthlySavings * 12;

  const plans = [
    {
      id: 'trial',
      name: '30-Day Free Trial',
      badge: 'Starter',
      price: '₹0',
      period: 'for 1 month',
      description: 'Auto-activated for all new users upon sign up.',
      features: ['Flat 30% OFF on all 8 brands', '₹0 Delivery Fee on all orders', '₹0 Packaging Fee'],
      highlight: false,
      buttonText: 'Current Active Plan',
    },
    {
      id: 'quarterly',
      name: 'Quarterly Pro',
      badge: 'Popular',
      price: '₹149',
      period: 'for 3 months',
      description: 'Perfect for regular foodies ordering twice a week.',
      features: ['Flat 30% OFF on all 8 brands', '₹0 Delivery Fee on all orders', '₹0 Packaging Fee', 'Priority Kitchen Queue'],
      highlight: false,
      buttonText: 'Subscribe Quarterly',
    },
    {
      id: 'annual',
      name: 'Annual Gold',
      badge: 'Best Value',
      price: '₹499',
      period: 'for 12 months',
      description: 'Maximum savings for food lovers & cloud kitchen fans.',
      features: [
        'Flat 30% OFF on all 8 brands',
        '₹0 Delivery Fee on all orders',
        '₹0 Packaging Fee',
        'Priority Kitchen Queue',
        'Exclusive Secret Brand Drops',
        'VIP Rider Dispatching',
      ],
      highlight: true,
      buttonText: 'Subscribe Annual Gold',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 text-xs font-extrabold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Storefront</span>
        </button>
      </div>

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 p-8 sm:p-12 text-white border border-rose-900/40 shadow-2xl space-y-6">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />
          <span>Eatclub Pro Membership Engine</span>
        </div>

        <div className="max-w-2xl space-y-3">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Unlock <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-amber-300 to-amber-400">FLAT 30% OFF</span> + ₹0 Delivery & Packaging Fees
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            One single membership unlocks unlimited savings across all 8 premium cloud kitchen brands: MOJO Pizza, BOX8, ZAZA Biryani, LeanCrust, WeFit, NH1 Bowls, Mealful Rolls & Zulu's Pizza.
          </p>
        </div>

        {/* Highlighted Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-black">30%</div>
            <div>
              <h4 className="text-xs font-bold text-white">Flat 30% Discount</h4>
              <p className="text-[10px] text-slate-400">Applied on every item automatically</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">₹0</div>
            <div>
              <h4 className="text-xs font-bold text-white">Zero Delivery Fees</h4>
              <p className="text-[10px] text-slate-400">Save ₹45 per order every time</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">₹0</div>
            <div>
              <h4 className="text-xs font-bold text-white">Zero Packaging Charges</h4>
              <p className="text-[10px] text-slate-400">Save ₹25 packaging cost per order</p>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Savings Calculator */}
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Historical Savings Calculator</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">See how fast your Eatclub Pro membership pays for itself</p>
            </div>
          </div>

          <div className="px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Estimated Annual ROI</span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {Math.round((totalYearlySavings / 499) * 10) / 10}x ROI
            </div>
          </div>
        </div>

        {/* Interactive Order Count Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-700 dark:text-slate-300">
              How many orders do you place per month?
            </label>
            <span className="px-3 py-1 rounded-xl bg-rose-600 text-white font-black text-xs tabular-nums">
              {monthlyOrders} Orders / Month
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="20"
            value={monthlyOrders}
            onChange={(e) => setMonthlyOrders(Number(e.target.value))}
            className="w-full h-2.5 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-600"
          />

          <div className="flex justify-between text-[10px] text-gray-400 font-semibold">
            <span>1 order/mo</span>
            <span>5 orders/mo</span>
            <span>10 orders/mo</span>
            <span>20 orders/mo</span>
          </div>
        </div>

        {/* Savings Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/80 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">30% Food Discount Savings</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
              ₹{(monthlyOrders * discountPerOrder * 12).toLocaleString()} <span className="text-xs font-normal text-gray-400">/ yr</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/80 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Waived Delivery & Packaging</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
              ₹{(monthlyOrders * (deliverySavingsPerOrder + packagingSavingsPerOrder) * 12).toLocaleString()} <span className="text-xs font-normal text-gray-400">/ yr</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white space-y-1 shadow-lg shadow-emerald-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Total Net Prospective Savings</span>
            <div className="text-3xl font-black tabular-nums">
              ₹{totalYearlySavings.toLocaleString()} <span className="text-xs font-semibold text-emerald-100">/ yr</span>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Comparisons */}
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Choose Your Membership Plan</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">Cancel or upgrade anytime with zero extra fees</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id as any)}
              className={`relative cursor-pointer rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between ${
                plan.highlight
                  ? 'bg-slate-900 text-white border-2 border-rose-500 shadow-2xl scale-105'
                  : selectedPlan === plan.id
                  ? 'bg-white dark:bg-slate-900 border-2 border-rose-500 shadow-xl'
                  : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-rose-300'
              }`}
            >
              {plan.badge && (
                <span className={`absolute -top-3.5 right-6 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  plan.highlight
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                }`}>
                  {plan.badge}
                </span>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-extrabold">{plan.name}</h3>
                  <p className={`text-xs ${plan.highlight ? 'text-slate-400' : 'text-gray-500 dark:text-slate-400'}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black tabular-nums">{plan.price}</span>
                  <span className={`text-xs ${plan.highlight ? 'text-slate-400' : 'text-gray-500 dark:text-slate-400'}`}>
                    {plan.period}
                  </span>
                </div>

                <ul className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800/80">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-semibold">
                      <Check className={`w-4 h-4 shrink-0 ${plan.highlight ? 'text-rose-400' : 'text-emerald-500'}`} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isAuthenticated && onOpenAuthModal) {
                    onOpenAuthModal();
                  } else {
                    alert(`Selected Plan: ${plan.name}`);
                  }
                }}
                className={`mt-6 w-full py-3 rounded-2xl font-extrabold text-xs transition-all ${
                  plan.highlight
                    ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400 shadow-lg shadow-rose-600/30'
                    : 'bg-rose-600 text-white hover:bg-rose-700'
                }`}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
