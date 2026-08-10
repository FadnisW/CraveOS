'use client';

import React, { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types';
import { api } from '../lib/api-client';
import { Clock, MapPin, CheckCircle2, ShieldCheck, Phone, ArrowLeft, RefreshCw, ChefHat, Bike } from 'lucide-react';
import { motion } from 'motion/react';

interface OrdersScreenProps {
  activeOrder: Order | null;
  onBackToHome: () => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({ activeOrder: initialOrder, onBackToHome }) => {
  const [activeOrder, setActiveOrder] = useState<Order | null>(initialOrder);
  const [simulatedStatus, setSimulatedStatus] = useState<OrderStatus>(initialOrder?.status || 'PREPARING');
  const [etaMins, setEtaMins] = useState<number>(20);

  useEffect(() => {
    setActiveOrder(initialOrder);
    if (initialOrder?.status) {
      setSimulatedStatus(initialOrder.status);
    }
  }, [initialOrder]);

  useEffect(() => {
    if (!activeOrder?.id) return;

    // Real-time backend status polling (fallback to timer)
    const interval = setInterval(async () => {
      try {
        const liveOrder = await api.getOrderById(activeOrder.id).catch(() => null);
        if (liveOrder) {
          setSimulatedStatus(liveOrder.status || 'PREPARING');
        }
      } catch (e) {
        // Fallback local ETA countdown
      }
      setEtaMins((prev) => Math.max(1, prev - 1));
    }, 5000);

    return () => clearInterval(interval);
  }, [activeOrder?.id]);

  const steps = [
    { key: 'PLACED', label: 'Order Placed', icon: CheckCircle2 },
    { key: 'ACCEPTED_BY_KITCHEN', label: 'Kitchen Accepted', icon: ChefHat },
    { key: 'PREPARING', label: 'Preparing Fresh', icon: RefreshCw },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Bike },
    { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 },
  ];

  if (!activeOrder) {
    return (
      <div className="text-center py-20 space-y-4">
        <Clock className="w-12 h-12 text-gray-400 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">No active orders right now</h2>
        <button
          onClick={onBackToHome}
          className="px-6 py-2.5 rounded-xl bg-rose-600 text-white font-extrabold text-xs shadow-md"
        >
          Explore Menu
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <button
        onClick={onBackToHome}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 text-xs font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Storefront</span>
      </button>

      {/* Live Tracker Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-rose-900 via-slate-900 to-slate-900 text-white shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Live Order Status</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold">{activeOrder.id}</h1>
          </div>

          <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Estimated Delivery</span>
            <div className="text-2xl font-black text-emerald-400">{etaMins} Mins</div>
          </div>
        </div>

        {/* Timeline Steps */}
        <div className="grid grid-cols-5 gap-2 pt-4">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = idx <= 2; // Simulated completion
            return (
              <div key={s.key} className="flex flex-col items-center text-center space-y-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCompleted
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30'
                    : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-300 line-clamp-1">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Order Fan-Out Status (Per Brand in Kitchen Hub) */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
          <h3 className="text-xs font-bold text-slate-300">Cloud Kitchen Brand Preparation Status:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeOrder.brandStatuses.map((bs) => (
              <div key={bs.brandId} className="flex items-center justify-between p-2 rounded-xl bg-white/5 text-xs">
                <span className="font-bold text-white">{bs.brandName}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {bs.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Rider Info Card */}
        {activeOrder.rider && (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/10 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center font-bold text-white">
                RK
              </div>
              <div>
                <h4 className="text-sm font-bold">{activeOrder.rider.name}</h4>
                <p className="text-xs text-slate-300">Delivery Executive • {activeOrder.rider.rating} ★</p>
              </div>
            </div>
            
            <a
              href={`tel:${activeOrder.rider.phone}`}
              className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold transition-colors"
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
