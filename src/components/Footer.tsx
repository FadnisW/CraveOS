'use client';

import React from 'react';
import { ShieldCheck, Phone, Mail, MapPin } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string) => void;
}

/**
 * Legal and support identity values are deliberately marked placeholders.
 * They must be replaced with the registered entity's real details before the
 * launch gate in docs/FEATURES.md can pass.
 */
const LEGAL_ENTITY_NAME = '{{LEGAL_ENTITY_NAME}}';
const SUPPORT_EMAIL = '{{SUPPORT_EMAIL}}';
const SUPPORT_PHONE = '{{SUPPORT_PHONE}}';
const REGISTERED_ADDRESS = '{{REGISTERED_ADDRESS}}';

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="relative bg-slate-950 text-slate-300 border-t border-slate-800/80 overflow-hidden pt-12 pb-24 sm:pb-12">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-48 bg-gradient-to-b from-rose-500/10 via-amber-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-900 pb-10">
          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Live menu
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Prices and availability come from the kitchen database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Online payments
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                UPI and cards are processed by Razorpay. Wallet orders debit the
                stored balance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Two Bengaluru hubs
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                HSR Layout and Indiranagar. Serviceability is checked against
                each hub's polygon.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
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
              A multi-brand cloud kitchen storefront. Browse the live menu,
              order from the hub that serves your address, and track the order
              as the kitchen and rider update it.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button onClick={() => onNavigate('home')} className="hover:text-rose-400 transition-colors">
                  Home
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('menu')} className="hover:text-rose-400 transition-colors">
                  Full menu
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('orders')} className="hover:text-rose-400 transition-colors">
                  Order tracking
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('profile')} className="hover:text-rose-400 transition-colors">
                  Profile and wallet
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200">
              Customer Support
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-rose-500" />
                <span title="Placeholder — replace before launch">{SUPPORT_EMAIL}</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-rose-500" />
                <span title="Placeholder — replace before launch">{SUPPORT_PHONE}</span>
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                <span title="Placeholder — replace before launch">{REGISTERED_ADDRESS}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} {LEGAL_ENTITY_NAME}. All rights reserved.
          </p>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Payments processed by Razorpay
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
