'use client';

import React from 'react';
import { useCart } from '../context/CartContext';
import { AlertTriangle, Trash2, ArrowRight, X, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const HubConflictModal: React.FC = () => {
  const { pendingConflict, resolveConflict, cartItems } = useCart();

  if (!pendingConflict) return null;

  const { newItem, currentHubId, newHubId } = pendingConflict;

  const formatHubName = (id: string) => {
    if (id === 'hub-hsr-01') return 'HSR Layout Cloud Hub #01';
    if (id === 'hub-indiranagar-02') return 'Indiranagar Cloud Hub #02';
    return id.replace('hub-', '').replace(/-/g, ' ').toUpperCase();
  };

  const currentHubName = formatHubName(currentHubId);
  const newHubName = formatHubName(newHubId);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 text-gray-900 dark:text-white"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-sm">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Single Cloud Hub Guarantee
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  CraveOS single-rider delivery rule
                </p>
              </div>
            </div>

            <button
              onClick={() => resolveConflict(false)}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Cancel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conflict Explanation */}
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 space-y-2 text-xs leading-relaxed">
            <p className="text-amber-900 dark:text-amber-200 font-medium">
              Your cart currently contains <strong>{cartItems.length} item(s)</strong> prepared at{' '}
              <span className="font-bold underline decoration-amber-500">{currentHubName}</span>.
            </p>
            <p className="text-amber-800 dark:text-amber-300/90">
              <strong>{newItem.name}</strong> is only serviced by{' '}
              <span className="font-bold underline decoration-amber-500">{newHubName}</span>.
              To guarantee unified 22-minute delivery in a single trip, all items in your cart must come from the same kitchen hub.
            </p>
          </div>

          {/* Visual Hub Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 block">
                Current Hub ({cartItems.length} items)
              </span>
              <div className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-slate-200">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="truncate">{currentHubName}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                New Item's Hub
              </span>
              <div className="flex items-center gap-1.5 font-bold text-rose-900 dark:text-rose-200">
                <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="truncate">{newHubName}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={() => resolveConflict(false)}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-extrabold text-xs transition-colors"
            >
              Keep Current Cart
            </button>

            <button
              onClick={() => resolveConflict(true)}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/30 flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Cart & Switch Hub</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
