'use client';

import React, { useState } from 'react';
import { MOCK_MENU_ITEMS, MOCK_BRANDS } from '../data/mockData';
import { ChefHat, Clock, AlertTriangle, CheckCircle2, RefreshCw, XCircle, ArrowLeft, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface KDSTicket {
  id: string;
  orderId: string;
  brandId: string;
  brandName: string;
  items: { name: string; quantity: number; options?: string }[];
  status: 'SENT_TO_KITCHEN' | 'PREPARING' | 'READY' | 'REJECTED';
  timeElapsedMins: number;
  tableOrOrderType: string;
}

interface AdminKDSViewProps {
  onBackToStorefront: () => void;
}

export const AdminKDSView: React.FC<AdminKDSViewProps> = ({ onBackToStorefront }) => {
  const [activeBrandFilter, setActiveBrandFilter] = useState<string>('all');
  const [outOfStockItems, setOutOfStockItems] = useState<string[]>([]);
  const [showStockModal, setShowStockModal] = useState<boolean>(false);

  const [tickets, setTickets] = useState<KDSTicket[]>([
    {
      id: 'BO-88101',
      orderId: 'ORD-942810',
      brandId: 'mojo-pizza',
      brandName: 'MOJO Pizza',
      items: [
        { name: 'Crowd Favorite Pepperoni 10"', quantity: 1, options: 'Hand Tossed, Extra Cheese' },
        { name: 'Garlic Breadstix with Dip', quantity: 1 },
      ],
      status: 'SENT_TO_KITCHEN',
      timeElapsedMins: 3,
      tableOrOrderType: 'Delivery Hub Order',
    },
    {
      id: 'BO-88102',
      orderId: 'ORD-942810',
      brandId: 'box8',
      brandName: 'BOX8 Desi Meals',
      items: [
        { name: 'Butter Chicken All-in-1 Meal', quantity: 2 },
      ],
      status: 'PREPARING',
      timeElapsedMins: 8,
      tableOrOrderType: 'Delivery Hub Order',
    },
    {
      id: 'BO-88103',
      orderId: 'ORD-942815',
      brandId: 'zaza-biryani',
      brandName: 'ZAZA Mughal Biryani',
      items: [
        { name: 'Hyderabadi Chicken Dum Biryani', quantity: 1 },
      ],
      status: 'PREPARING',
      timeElapsedMins: 12,
      tableOrOrderType: 'Delivery Hub Order',
    },
  ]);

  const handleUpdateStatus = (ticketId: string, newStatus: KDSTicket['status']) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
    );
  };

  const toggleItemStock = (itemId: string) => {
    setOutOfStockItems((prev) =>
      prev.includes(itemId) ? prev.filter((i) => i !== itemId) : [...prev, itemId]
    );
  };

  const filteredTickets = activeBrandFilter === 'all'
    ? tickets
    : tickets.filter((t) => t.brandId === activeBrandFilter);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center font-bold text-white shadow-md">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold">Kitchen Display System (KDS)</h1>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                HUB: HSR Layout #01
              </span>
            </div>
            <p className="text-xs text-slate-400">Real-time multi-brand order preparation & SLA management</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowStockModal(true)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5"
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Manage 86'd Items ({outOfStockItems.length})</span>
          </button>

          <button
            onClick={onBackToStorefront}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Storefront</span>
          </button>
        </div>
      </div>

      {/* Brand Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveBrandFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeBrandFilter === 'all'
              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
          }`}
        >
          All Brands ({tickets.length})
        </button>
        {MOCK_BRANDS.map((b) => (
          <button
            key={b.id}
            onClick={() => setActiveBrandFilter(b.id)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
              activeBrandFilter === b.id
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
            }`}
          >
            {b.name.split(' - ')[0]}
          </button>
        ))}
      </div>

      {/* KDS Tickets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTickets.map((ticket) => {
          const isUrgent = ticket.timeElapsedMins > 10;
          return (
            <motion.div
              key={ticket.id}
              layout
              className={`rounded-3xl border overflow-hidden shadow-sm space-y-4 p-6 bg-white dark:bg-slate-800 ${
                isUrgent ? 'border-amber-500/80 ring-2 ring-amber-500/20' : 'border-gray-200 dark:border-slate-700'
              }`}
            >
              {/* Ticket Header */}
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    {ticket.brandName}
                  </span>
                  <h3 className="text-base font-black text-gray-900 dark:text-white">{ticket.id}</h3>
                  <span className="text-[10px] text-gray-400">Parent: {ticket.orderId}</span>
                </div>

                <div className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 ${
                  isUrgent ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{ticket.timeElapsedMins}m SLA</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                {ticket.items.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between text-xs font-semibold">
                    <div>
                      <span className="text-gray-900 dark:text-white font-extrabold">{item.quantity}x </span>
                      <span className="text-gray-800 dark:text-slate-200">{item.name}</span>
                      {item.options && (
                        <p className="text-[10px] text-gray-400 font-normal">{item.options}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Status Action Buttons */}
              <div className="pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2">
                {ticket.status === 'SENT_TO_KITCHEN' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(ticket.id, 'PREPARING')}
                      className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 shadow-sm"
                    >
                      <ChefHat className="w-3.5 h-3.5" /> Accept & Cook
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(ticket.id, 'REJECTED')}
                      className="py-2 px-3 rounded-xl bg-gray-100 hover:bg-rose-50 text-gray-500 hover:text-rose-600 text-xs font-bold"
                      title="Reject & Auto-Refund Customer"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}

                {ticket.status === 'PREPARING' && (
                  <button
                    onClick={() => handleUpdateStatus(ticket.id, 'READY')}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Mark Ready for Rider
                  </button>
                )}

                {ticket.status === 'READY' && (
                  <div className="w-full py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-center text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                    ✓ Packed & Waiting at Dispatch Bay
                  </div>
                )}

                {ticket.status === 'REJECTED' && (
                  <div className="w-full py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-center text-xs font-extrabold text-rose-700 dark:text-rose-300">
                    ✕ Rejected (Wallet Refunded)
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 86'd Out-of-Stock Item Manager Modal */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Mark Items Out of Stock ("86")</h3>
              <button onClick={() => setShowStockModal(false)} className="text-gray-400 hover:text-gray-900">
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400">
              Disabling an item hides it instantly from the customer storefront across all 8 brands.
            </p>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {MOCK_MENU_ITEMS.map((item) => {
                const isOff = outOfStockItems.includes(item.id);
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs">
                    <div>
                      <span className="font-bold text-gray-900 dark:text-white">{item.name}</span>
                      <span className="text-[10px] text-gray-400 block">{item.brandId.toUpperCase()}</span>
                    </div>

                    <button
                      onClick={() => toggleItemStock(item.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        isOff
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {isOff ? '86\'d (Out of Stock)' : 'Available'}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowStockModal(false)}
              className="w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-extrabold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
