'use client';

import React from 'react';
import { api } from '../lib/api-client';
import { useUser } from '../context/UserContext';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState } from '../components/ui/Feedback';
import {
  KeyRound,
  LogOut,
  MapPin,
  Plus,
  Receipt,
  Wallet,
} from 'lucide-react';

interface ProfileScreenProps {
  onNavigate: (view: string) => void;
  onOpenAuthModal?: () => void;
  onOpenAddressModal?: () => void;
}

interface WalletResponse {
  balanceRupees: number;
  transactions: Array<{
    id: string;
    amountInPaise: number;
    reason: string;
    createdAt: string;
  }>;
}

const REASON_LABELS: Record<string, string> = {
  WELCOME_BONUS: 'Welcome credit',
  ORDER_SPEND: 'Order payment',
  ORDER_REFUND: 'Order refund',
  PARTIAL_ORDER_REFUND: 'Partial order refund',
  ADMIN_ADJUSTMENT: 'Admin adjustment',
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onNavigate,
  onOpenAuthModal,
  onOpenAddressModal,
}) => {
  const { user, isAuthenticated, logout } = useUser();

  const wallet = useApi<WalletResponse>(
    () => api.getWalletBalance(user!.id),
    [user?.id],
    !!user?.id,
  );

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black text-3xl mx-auto border border-rose-500/20">
          <KeyRound className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto">
            View your orders, saved addresses, and wallet balance.
          </p>
        </div>

        <button
          onClick={onOpenAuthModal}
          className="px-8 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-xl shadow-rose-600/30 transition-all inline-flex items-center gap-2"
        >
          <KeyRound className="w-4 h-4" />
          <span>Sign in with OTP</span>
        </button>
      </div>
    );
  }

  const balance = wallet.data?.balanceRupees ?? user.walletBalance;
  const transactions = wallet.data?.transactions || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-rose-950 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center font-black text-2xl border border-white/20">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold">
              {user.name || user.email || 'Your account'}
            </h1>
            <p className="text-xs text-slate-300">
              {[user.phone, user.email].filter(Boolean).join(' • ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
          <button
            onClick={() => onNavigate('orders')}
            className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-extrabold inline-flex items-center gap-2"
          >
            <Receipt className="w-4 h-4" />
            My orders
          </button>
          <button
            onClick={logout}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                Wallet
              </h3>
            </div>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{balance.toFixed(2)}
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-slate-400">
            Wallet credits can be applied at checkout. The balance above is read
            from your account, not estimated.
          </p>

          {wallet.loading && (
            <div className="h-16 rounded-xl bg-gray-100 dark:bg-slate-700 animate-pulse" />
          )}

          {wallet.error && (
            <ErrorState
              title="Could not load wallet activity"
              message={wallet.error}
              onRetry={() => void wallet.reload()}
            />
          )}

          {!wallet.loading && !wallet.error && transactions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-700">
              {transactions.slice(0, 5).map((transaction) => {
                const rupees = transaction.amountInPaise / 100;
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-gray-600 dark:text-slate-300">
                      {REASON_LABELS[transaction.reason] || transaction.reason}
                    </span>
                    <span
                      className={
                        rupees >= 0
                          ? 'font-extrabold text-emerald-600 dark:text-emerald-400'
                          : 'font-extrabold text-rose-600 dark:text-rose-400'
                      }
                    >
                      {rupees >= 0 ? '+' : '−'}₹{Math.abs(rupees).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
              Saved addresses
            </h3>
            {onOpenAddressModal && (
              <button
                onClick={onOpenAddressModal}
                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-600 dark:text-rose-400"
              >
                <Plus className="w-3.5 h-3.5" /> Manage
              </button>
            )}
          </div>

          {user.savedAddresses.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="No saved addresses"
              description="Add a delivery address to check which hub serves you."
              action={
                onOpenAddressModal ? (
                  <button
                    onClick={onOpenAddressModal}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold"
                  >
                    Add address
                  </button>
                ) : undefined
              }
            />
          )}

          {user.savedAddresses.length > 0 && (
            <div className="space-y-2">
              {user.savedAddresses.map((address) => (
                <div
                  key={address.id}
                  className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200/70 dark:border-slate-700 flex items-start gap-3"
                >
                  <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase text-gray-900 dark:text-white">
                      {address.label}
                      {address.isDefault && (
                        <span className="ml-2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                          DEFAULT
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                      {address.addressLine}
                      {address.city ? `, ${address.city}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
