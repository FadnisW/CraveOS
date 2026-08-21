'use client';

import React from 'react';
import { Sparkles, ShieldCheck, Heart, Phone, Mail, MapPin, ExternalLink, ArrowUpRight, Lock, Award } from 'lucide-react';
import { motion } from 'motion/react';
import { SpotlightCard } from './SpotlightCard';

interface FooterProps {
  onNavigate: (view: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const brandLogos = [
    { name: 'MOJO Pizza', logo: '/Brand Logo/Mojo Pizza.png', bg: '#FF6B00' },
    { name: 'BOX8 Desi Meals', logo: '/Brand Logo/Box8.png', bg: '#D97706' },
    { name: 'LeanCrust Pizza', logo: '/Brand Logo/LeanCrust Pizza.png', bg: '#3B82F6' },
    { name: 'ZAZA Biryani', logo: '/Brand Logo/Zaza.png', bg: '#8B5CF6' },
    { name: 'WeFit Meals', logo: '/Brand Logo/Wefit.png', bg: '#10B981' },
  ];

  return (
    <footer className="relative bg-slate-950 text-slate-300 border-t border-slate-800/80 overflow-hidden pt-12 pb-24 sm:pb-12">
      {/* Decorative Gradient Glow (Spotlight background effect) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-48 bg-gradient-to-b from-rose-500/10 via-amber-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
        {/* EatClub Member Guarantee — Sleek 3-Pillar Benefit Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-900 pb-10">
          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 font-bold text-sm">
              30%
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Flat 30% Savings</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Applied automatically on every item across 8 brands</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">₹0 Hidden Fees</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Zero delivery fee, zero packaging fee, zero surge charges</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">22-Min Express Delivery</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Direct hot dispatch from your local cloud kitchen hub</p>
            </div>
          </div>
        </div>

        {/* Main Footer Links & Brand Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Identity & Mission */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md">
                E
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-1.5">
                eatclub
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                  Cloud Kitchen
                </span>
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              India's highest rated cloud kitchen ecosystem. Operating 8 exclusive brands from 1 unified hub — delivered fresh in 22 minutes with zero surge or hidden fees.
            </p>

            {/* Cloud Kitchen Brand Badges Carousel / Strip */}
            <div className="pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Our Cloud Kitchen Brands
              </span>
              <div className="flex items-center gap-2.5 flex-wrap">
                {brandLogos.map((b) => (
                  <div
                    key={b.name}
                    className="w-8 h-8 rounded-full bg-white p-0.5 shadow-sm border border-slate-700 flex items-center justify-center hover:scale-110 transition-transform"
                    title={b.name}
                  >
                    <img src={b.logo} alt={b.name} className="w-full h-full object-contain rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button onClick={() => onNavigate('home')} className="hover:text-rose-400 transition-colors">
                  Home & Stores
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('deals')} className="hover:text-rose-400 transition-colors">
                  Offers & 1+1 Deals
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('orders')} className="hover:text-rose-400 transition-colors">
                  Order Tracking
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('profile')} className="hover:text-rose-400 transition-colors">
                  My Profile & Wallet
                </button>
              </li>
            </ul>
          </div>

          {/* Brands List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200">
              Exclusive Brands
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>MOJO Pizza (2X Toppings)</li>
              <li>BOX8 (Desi Meals & Thalis)</li>
              <li>LeanCrust (Thin Crust Experts)</li>
              <li>ZAZA (Mughal Biryani)</li>
              <li>WeFit (High Protein Bowls)</li>
            </ul>
          </div>

          {/* Support & Contact Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200">
              Customer Support
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-rose-500" />
                <span>support@eatclub.in</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-rose-500" />
                <span>+91 80 4719 2000</span>
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Cloud Hub HSR Sector 2, Bengaluru</span>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Trust Badges */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} CraveOS / EatClub. All rights reserved.</p>
          
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 100% Safe Payments
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Award className="w-3.5 h-3.5 text-amber-400" /> 4.7★ Rated Cloud Kitchens
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
