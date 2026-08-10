'use client';

import React, { useState } from 'react';
import { Bike, MapPin, Clock, ArrowLeft, UserCheck, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface Rider {
  id: string;
  name: string;
  phone: string;
  status: 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY';
  rating: number;
  activeOrderId?: string;
  etaMins?: number;
}

interface AdminDispatchViewProps {
  onBackToStorefront: () => void;
}

export const AdminDispatchView: React.FC<AdminDispatchViewProps> = ({ onBackToStorefront }) => {
  const [riders, setRiders] = useState<Rider[]>([
    { id: 'R1', name: 'Ramesh Kumar', phone: '+91 98123 45678', status: 'ON_TRIP', rating: 4.9, activeOrderId: 'ORD-942810', etaMins: 14 },
    { id: 'R2', name: 'Suresh Patel', phone: '+91 98765 12345', status: 'AVAILABLE', rating: 4.8 },
    { id: 'R3', name: 'Vikram Singh', phone: '+91 98222 33344', status: 'AVAILABLE', rating: 4.7 },
    { id: 'R4', name: 'Anil Sharma', phone: '+91 98444 55566', status: 'OFF_DUTY', rating: 4.9 },
  ]);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-md">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold">Rider Dispatch & Logistics Console</h1>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                HUB: HSR Layout #01
              </span>
            </div>
            <p className="text-xs text-slate-400">Hyperlocal fleet assignment & live delivery SLA monitoring</p>
          </div>
        </div>

        <button
          onClick={onBackToStorefront}
          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Storefront</span>
        </button>
      </div>

      {/* Fleet Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Available Fleet</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {riders.filter((r) => r.status === 'AVAILABLE').length} Riders
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Active Delivery Trips</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {riders.filter((r) => r.status === 'ON_TRIP').length} Trips
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Avg Delivery SLA</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              18.4 Mins
            </div>
          </div>
        </div>
      </div>

      {/* Fleet Roster List */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 space-y-4">
        <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Hub Delivery Fleet Roster</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {riders.map((rider) => (
            <div
              key={rider.id}
              className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200/80 dark:border-slate-700 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-extrabold text-sm text-slate-800 dark:text-white">
                  {rider.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">{rider.name}</h4>
                  <p className="text-[10px] text-gray-400">{rider.phone} • {rider.rating} ★</p>
                </div>
              </div>

              <div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                  rider.status === 'AVAILABLE'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : rider.status === 'ON_TRIP'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-400'
                }`}>
                  {rider.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
