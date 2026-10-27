'use client';

import React from 'react';
import { ShoppingBag, Search, MapPin, Sun, Moon, ChevronDown, User, KeyRound, LogOut } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { motion } from 'motion/react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenCart: () => void;
  onOpenAddressModal: () => void;
  onOpenAuthModal: () => void;
  activeAddressLabel?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenCart,
  onOpenAddressModal,
  onOpenAuthModal,
  activeAddressLabel = 'Select delivery address',
}) => {
  const { theme, toggleTheme } = useTheme();
  const { itemCount } = useCart();
  const { user, isAuthenticated, isMounted, logout } = useUser();

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-gray-200/80 dark:border-slate-800/80 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-rose-500/25 group-hover:scale-105 transition-transform duration-200">
                E
              </div>
              <div className="flex flex-col text-left">
                <span className="font-extrabold text-xl tracking-tight text-gray-900 dark:text-white flex items-center gap-1">
                  eatclub
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                    Cloud Kitchen
                  </span>
                </span>
                <span className="text-[10px] font-medium text-gray-500 dark:text-slate-400 -mt-1">
                  One cart • multiple kitchens
                </span>
              </div>
            </button>

            {/* Hyper-Location Selector Pill */}
            <button
              onClick={onOpenAddressModal}
              className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gray-100 dark:bg-slate-800/80 hover:bg-gray-200/80 dark:hover:bg-slate-700/80 border border-gray-200 dark:border-slate-700/60 text-xs font-semibold text-gray-800 dark:text-slate-200 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="max-w-[200px] truncate">{activeAddressLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>

          {/* Search Bar — slim pill style */}
          <div className="hidden lg:flex flex-1 max-w-sm mx-6">
            <button
              onClick={() => onNavigate('search')}
              className="group w-full flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-gray-100/70 dark:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200/50 dark:border-slate-700/40 hover:border-gray-300/60 dark:hover:border-slate-600/60 text-left transition-all duration-200 shadow-sm"
            >
              <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 shrink-0" />
              <span className="flex-1 text-[13px] text-gray-400 dark:text-slate-500 font-normal truncate">
                Search dishes, brands…
              </span>
            </button>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-3">
            {/* Search Button (Mobile/Tablet) */}
            <button
              onClick={() => onNavigate('search')}
              className="lg:hidden p-2 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Light / Dark Mode Toggle Switch */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-amber-400 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200/80 dark:border-slate-700/80 transition-all duration-200"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {/* Orders Shortcut */}
            <button
              onClick={() => onNavigate('orders')}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                currentView === 'orders'
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              Orders
            </button>

            {/* Auth Control — only rendered after client hydration to prevent SSR mismatch */}
            {!isMounted ? (
              // Stable skeleton that matches SSR output (avoids hydration error)
              <button className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-800 dark:text-slate-200">
                <KeyRound className="w-3.5 h-3.5 text-rose-500" />
                <span>Sign In</span>
              </button>
            ) : isAuthenticated ? (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => onNavigate('profile')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    currentView === 'profile'
                      ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-rose-500" />
                  <span>{user?.name?.split(' ')[0] || 'Account'}</span>
                </button>
                <button
                  onClick={logout}
                  className="p-2 rounded-xl text-gray-500 hover:text-rose-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-gray-800 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 border border-gray-200 dark:border-slate-700 text-xs font-bold transition-all"
              >
                <KeyRound className="w-3.5 h-3.5 text-rose-500" />
                <span>Sign In</span>
              </button>
            )}

            {/* Multi-Brand Cart Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onOpenCart}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-600/30 transition-all duration-200"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Cart</span>

              {itemCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-extrabold rounded-full bg-white text-rose-600 dark:bg-slate-900 dark:text-rose-400 shadow-sm animate-bounce">
                  {itemCount}
                </span>
              )}
            </motion.button>
          </div>

        </div>
      </div>
    </header>
  );
};
