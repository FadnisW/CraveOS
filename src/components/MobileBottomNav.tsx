'use client';

import React from 'react';
import { Home, Compass, ShoppingBag, User, Clock } from 'lucide-react';
import { useCart } from '../context/CartContext';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenCart: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenCart,
}) => {
  const { itemCount } = useCart();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'menu', label: 'Menu', icon: Compass },
    { id: 'orders', label: 'Orders', icon: Clock },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 px-2 py-2">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-rose-600 dark:text-rose-400 font-bold'
                  : 'text-gray-500 dark:text-slate-400 font-medium hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}

        {/* Floating Cart Button for Mobile */}
        <button
          onClick={onOpenCart}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-rose-600 dark:text-rose-400 relative"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                {itemCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold">Cart</span>
        </button>
      </div>
    </div>
  );
};
