'use client';

import React, { useState } from 'react';
import { MOCK_USER } from '../data/mockData';
import { SavedAddress } from '../types';
import { useCart } from '../context/CartContext';
import { api } from '../lib/api-client';
import { X, MapPin, Check, Plus, Home, Briefcase, Building } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SavedAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAddressId: string;
  onSelectAddress: (address: SavedAddress) => void;
}

export const SavedAddressModal: React.FC<SavedAddressModalProps> = ({
  isOpen,
  onClose,
  selectedAddressId,
  onSelectAddress,
}) => {
  const { setPinnedHubId } = useCart();

  if (!isOpen) return null;

  const [addresses] = useState<SavedAddress[]>(MOCK_USER.savedAddresses);

  const handleSelect = async (addr: SavedAddress) => {
    onSelectAddress(addr);
    try {
      const serviceability = await api.resolveServiceability(addr.lat, addr.lng).catch(() => null);
      if (serviceability?.hubId) {
        setPinnedHubId(serviceability.hubId);
      }
    } catch (e) {
      // Keep existing pinned hub fallback
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Choose Delivery Address</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-900">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {addresses.map((addr) => {
              const isSelected = addr.id === selectedAddressId;
              const Icon = addr.type === 'home' ? Home : addr.type === 'work' ? Briefcase : Building;

              return (
                <div
                  key={addr.id}
                  onClick={() => handleSelect(addr)}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-start justify-between gap-3 transition-all ${
                    isSelected
                      ? 'border-rose-600 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                      : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-rose-600 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-gray-900 dark:text-white">{addr.label}</h4>
                      <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{addr.addressLine}</p>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        Resolved Hub: {addr.resolvedHubId} (20-25 mins)
                      </span>
                    </div>
                  </div>

                  {isSelected && <Check className="w-5 h-5 text-rose-600 shrink-0" />}
                </div>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white font-extrabold text-xs hover:bg-gray-200 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add New Address
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
