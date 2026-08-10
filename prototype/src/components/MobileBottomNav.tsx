import React from 'react';
import { TabType } from '../types';

interface MobileBottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  hasActiveOrder?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  hasActiveOrder,
}) => {
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'search', label: 'Search', icon: 'search' },
    { id: 'deals', label: 'Deals', icon: 'local_offer' },
    { id: 'orders', label: 'Orders', icon: 'receipt_long' },
    { id: 'profile', label: 'Profile', icon: 'person' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F0F0F]/95 backdrop-blur-md border-t border-white/10 px-2 py-2 shadow-2xl">
      <div className="grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative ${
                isActive ? 'text-[#C5A059] font-bold' : 'text-white/40 font-medium hover:text-white/80'
              }`}
            >
              <div className="relative">
                <span className={`material-symbols-outlined text-2xl ${isActive ? 'fill-icon' : ''}`}>
                  {tab.icon}
                </span>
                {tab.id === 'orders' && hasActiveOrder && (
                  <span className="absolute -top-0.5 -right-1.5 w-2.5 h-2.5 bg-[#C5A059] border-2 border-[#0F0F0F] rounded-full animate-pulse"></span>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-widest leading-none mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

