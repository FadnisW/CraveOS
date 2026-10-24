'use client';

import React, { useState, useEffect } from 'react';
import { MOCK_USER } from '../data/mockData';
import { api } from '../lib/api-client';
import { useUser } from '../context/UserContext';
import { ShieldCheck, Wallet, Share2, Copy, Gift, Clock, MapPin, User, LogOut, Check, KeyRound } from 'lucide-react';

interface ProfileScreenProps {
  onNavigate: (view: string) => void;
  onOpenAuthModal?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onNavigate, onOpenAuthModal }) => {
  const { user, isAuthenticated, logout } = useUser();
  const currentUser = user || MOCK_USER;

  const [walletBalance, setWalletBalance] = useState<number>(currentUser.walletBalance || 100);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [shared, setShared] = useState<boolean>(false);

  useEffect(() => {
    async function loadWallet() {
      if (!currentUser?.id) return;
      try {
        const res = await api.getWalletBalance(currentUser.id).catch(() => null);
        if (res) {
          setWalletBalance(res.balanceRupees ?? currentUser.walletBalance);
          setTransactions(res.transactions || []);
        }
      } catch (e) {
        console.warn('Wallet balance fetch failed:', e);
      }
    }
    loadWallet();
  }, [currentUser?.id]);

  const referralCode = currentUser.referralCode || 'EATCLUB100';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Task 10 (SDD §4.2): Web Share API with clipboard fallback for desktop
  const handleShareCode = async () => {
    const shareData = {
      title: 'Join me on Eatclub!',
      text: `Use my referral code ${referralCode} and get ₹100 OFF your first order on Eatclub Cloud Kitchen!`,
      url: 'https://eatclub.in',
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      } else {
        // Desktop fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err: any) {
      // Share cancelled by user or failed — silently fall back to clipboard copy
      if (err?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(referralCode);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (_) {}
      }
    }
  };


  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black text-3xl mx-auto border border-rose-500/20">
          🔑
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">Sign In to Your Account</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto">
            Log in to view your order history, manage saved addresses, track your wallet balance, and unlock <strong>Flat 30% Member Discounts</strong>.
          </p>
        </div>

        <button
          onClick={onOpenAuthModal}
          className="px-8 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-xl shadow-rose-600/30 transition-all inline-flex items-center gap-2"
        >
          <KeyRound className="w-4 h-4" />
          <span>Sign In with OTP</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      
      {/* Member Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-2xl border border-white/30">
            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold">{currentUser.name}</h1>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300" /> Member
              </span>
            </div>
            <p className="text-xs text-rose-100">{currentUser.phone} • {currentUser.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
          <button
            onClick={() => onNavigate('membership')}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-center transition-all cursor-pointer"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-100">Total Savings</span>
            <div className="text-xl font-black text-amber-300">₹{currentUser.membershipPlan?.totalSavingsToDate || 1250} &rarr;</div>
          </button>
          <button
            onClick={logout}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Grid: Wallet & Referral */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Wallet Balance Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Eatclub Wallet</h3>
            </div>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{walletBalance}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Wallet credits are automatically applied at checkout towards your food orders.
          </p>
        </div>

        {/* Referral Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Refer & Earn ₹100</h3>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Share your referral code. Friends get ₹100 OFF and you get ₹100 wallet credit!
          </p>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-100 dark:bg-slate-700 text-xs font-bold gap-2">
            <span className="tracking-widest text-gray-900 dark:text-white font-mono">{referralCode}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleShareCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{shared ? 'Shared!' : 'Share Code'}</span>
              </button>
              <button onClick={handleCopyCode} className="flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Saved Addresses List */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Saved Addresses</h3>
        <div className="space-y-3">
          {MOCK_USER.savedAddresses.map((addr) => (
            <div key={addr.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-gray-900 dark:text-white">{addr.label}</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{addr.addressLine}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
