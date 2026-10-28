'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { useUser } from '../context/UserContext';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState } from '../components/ui/Feedback';
import { loadRazorpay, openRazorpay } from '../lib/razorpay';
import {
  BadgeCheck,
  Check,
  Copy,
  Gift,
  KeyRound,
  LogOut,
  MapPin,
  Plus,
  Receipt,
  Save,
  UserRound,
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

interface MembershipPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  durationDays: number;
  priceInPaise: number;
  priceRupees: number;
  monthlyEquivalentRupees: number;
  benefits: string[];
}

interface MembershipResponse {
  membership: {
    id: string;
    planId: string;
    planName: string;
    planSlug: string | null;
    status: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    startedAt: string;
    endsAt: string;
    isActive: boolean;
    autoRenew: boolean;
  } | null;
  purchases: Array<{
    id: string;
    planName: string;
    status: 'INITIATED' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
    amountInPaise: number;
    paymentMethod: string;
    startsAt: string | null;
    endsAt: string | null;
    createdAt: string;
  }>;
}

interface ReferralsResponse {
  code: string;
  reward: {
    referrerPaise: number;
    refereePaise: number;
    maxRewardedReferrals: number;
    earnedPaise: number;
    remainingRewardedSlots: number;
  };
  stats: {
    total: number;
    pending: number;
    rewarded: number;
    cancelled: number;
  };
  referrals: Array<{
    id: string;
    status: 'PENDING' | 'QUALIFIED' | 'REWARDED' | 'CANCELLED';
    rewardPaise: number;
    refereeRewardPaise: number;
    createdAt: string;
    referee: { name: string | null; email: string | null; joinedAt: string };
  }>;
}

const REASON_LABELS: Record<string, string> = {
  // Legacy rows only — new signups receive a coupon, not wallet cash.
  WELCOME_BONUS: 'Legacy welcome credit',
  ORDER_SPEND: 'Order payment',
  ORDER_REFUND: 'Order refund',
  PARTIAL_ORDER_REFUND: 'Partial order refund',
  MEMBERSHIP_PURCHASE: 'Membership purchase',
  REFERRAL_REWARD: 'Referral reward',
  ADMIN_ADJUSTMENT: 'Admin adjustment',
};

const REFERRAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Waiting for first delivery',
  QUALIFIED: 'Qualified',
  REWARDED: 'Rewarded',
  CANCELLED: 'Cancelled',
};

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `membership-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function daysRemaining(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onNavigate,
  onOpenAuthModal,
  onOpenAddressModal,
}) => {
  const { user, isAuthenticated, logout, refreshUser } = useUser();

  const wallet = useApi<WalletResponse>(
    () => api.getWalletBalance(user!.id),
    [user?.id],
    !!user?.id,
  );

  const plans = useApi<MembershipPlan[]>(() => api.membership.getPlans(), []);
  const membership = useApi<MembershipResponse>(
    () => api.membership.getMine(),
    [user?.id],
    !!user?.id,
  );
  const referrals = useApi<ReferralsResponse>(
    () => api.getMyReferrals(),
    [user?.id],
    !!user?.id,
  );
  const orders = useApi<any[]>(
    () => api.getUserOrders(user!.id),
    [user?.id],
    !!user?.id,
  );
  const offers = useApi<{ offers: any[] }>(() => api.getActiveOffers(), []);

  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
  const [purchaseMethod, setPurchaseMethod] = useState<
    'WALLET' | 'RAZORPAY' | null
  >(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [profileName, setProfileName] = useState<string>(user?.name || '');
  const [profilePhone, setProfilePhone] = useState<string>(user?.phone || '');
  const [profileSaving, setProfileSaving] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfilePhone(user?.phone || '');
  }, [user?.id, user?.name, user?.phone]);

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
            View your orders, membership, wallet balance and referrals.
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
  const currentMembership = membership.data?.membership || null;
  const purchasablePlans = plans.data || [];
  const referralData = referrals.data;
  const hasOrders = Array.isArray(orders.data) && orders.data.length > 0;

  // Advertise a first-order coupon only when the database returned an approved,
  // in-window promotion. There is no hardcoded offer copy.
  const activeOffers = offers.data?.offers || [];
  const firstOrderOffer =
    activeOffers.find((offer) => offer.firstOrderOnly) ||
    activeOffers.find((offer) => offer.perUserLimit === 1) ||
    null;

  const describeOffer = (offer: any) => {
    if (offer.type === 'PERCENT') {
      return `${offer.value}% off${
        offer.maxDiscountPaise
          ? ` up to ₹${(offer.maxDiscountPaise / 100).toFixed(0)}`
          : ''
      }`;
    }
    if (offer.type === 'FLAT') {
      return `₹${(offer.value / 100).toFixed(0)} off`;
    }
    if (offer.type === 'FREE_DELIVERY') return 'free delivery';
    return 'a discount';
  };

  const buyMembership = async (
    plan: MembershipPlan,
    method: 'WALLET' | 'RAZORPAY',
  ) => {
    setPurchasingPlanId(plan.id);
    setPurchaseMethod(method);
    setPurchaseError(null);
    setPurchaseNotice(null);

    try {
      const purchase = await api.membership.purchase({
        planId: plan.id,
        paymentMethod: method,
        idempotencyKey: newIdempotencyKey(),
      });

      if (method === 'RAZORPAY') {
        if (!purchase?.razorpay?.orderId || !purchase?.razorpay?.key) {
          throw new Error('The payment gateway is not configured.');
        }

        await loadRazorpay();
        const payment = await openRazorpay({
          key: purchase.razorpay.key,
          amount: purchase.razorpay.amount,
          currency: purchase.razorpay.currency,
          orderId: purchase.razorpay.orderId,
          name: 'CraveOS Membership',
          description: plan.name,
          prefill: {
            name: user.name,
            email: user.email,
            contact: user.phone,
          },
        });

        await api.membership.verifyPurchase(payment);
      }

      // Read the new state from the server instead of guessing locally.
      const me = await api.getMe();
      refreshUser(me.user);
      await membership.reload();
      await wallet.reload();

      setPurchaseNotice(
        method === 'WALLET'
          ? `${plan.name} is active. The price was paid from your wallet.`
          : `${plan.name} is active.`,
      );
    } catch (err: any) {
      setPurchaseError(err?.message || 'Could not complete this purchase.');
    } finally {
      setPurchasingPlanId(null);
      setPurchaseMethod(null);
    }
  };

  const copyReferralCode = async () => {
    if (!referralData?.code) return;
    try {
      await navigator.clipboard.writeText(referralData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — the code is still visible to copy by hand.
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileNotice(null);

    try {
      const result = await api.updateProfile({
        name: profileName.trim(),
        phone: profilePhone.trim() || null,
      });
      refreshUser(result.user);
      setProfileNotice('Profile updated.');
    } catch (err: any) {
      setProfileError(err?.message || 'Could not update your profile.');
    } finally {
      setProfileSaving(false);
    }
  };

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

      <form
        onSubmit={saveProfile}
        className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2">
          <UserRound className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <div>
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
              Profile
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              Your name and the phone the rider calls on delivery. Email is your
              sign-in identity and cannot be changed here.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] font-bold text-gray-600 dark:text-slate-300">
              Display name
            </span>
            <input
              type="text"
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              maxLength={80}
              placeholder="Your name"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-bold text-gray-600 dark:text-slate-300">
              Delivery phone
            </span>
            <input
              type="tel"
              value={profilePhone}
              onChange={(event) => setProfilePhone(event.target.value)}
              placeholder="10-digit Indian mobile"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </label>
        </div>

        {profileError && (
          <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
            {profileError}
          </p>
        )}
        {profileNotice && (
          <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            {profileNotice}
          </p>
        )}

        <button
          type="submit"
          disabled={profileSaving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-extrabold"
        >
          <Save className="w-3.5 h-3.5" />
          {profileSaving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

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
            Wallet credits can be applied at checkout or used to buy a
            membership. The balance above is read from your account, not
            estimated.
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
          <div className="flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
              Membership
            </h3>
          </div>

          {membership.loading && (
            <div className="h-16 rounded-xl bg-gray-100 dark:bg-slate-700 animate-pulse" />
          )}

          {membership.error && (
            <ErrorState
              title="Could not load your membership"
              message={membership.error}
              onRetry={() => void membership.reload()}
            />
          )}

          {!membership.loading && !membership.error && currentMembership && (
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200/70 dark:border-slate-700 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-gray-900 dark:text-white">
                  {currentMembership.planName}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                    currentMembership.isActive
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-gray-200 text-gray-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {currentMembership.isActive ? currentMembership.status : 'EXPIRED'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                {currentMembership.isActive
                  ? `${daysRemaining(currentMembership.endsAt)} day(s) left · ends ${formatDate(currentMembership.endsAt)}`
                  : `Ended ${formatDate(currentMembership.endsAt)}`}
              </p>
            </div>
          )}

          {!membership.loading && !membership.error && !currentMembership && (
            <p className="text-xs text-gray-500 dark:text-slate-400">
              No membership on this account.
            </p>
          )}

          {purchaseNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              {purchaseNotice}
            </div>
          )}

          {purchaseError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300">
              {purchaseError}
            </div>
          )}

          {plans.error && (
            <ErrorState
              title="Could not load membership plans"
              message={plans.error}
              onRetry={() => void plans.reload()}
            />
          )}

          {!plans.loading && !plans.error && (
            <div className="space-y-3">
              {purchasablePlans.map((plan) => {
                const walletTooLow = balance * 100 < plan.priceInPaise;
                const busy = purchasingPlanId === plan.id;

                return (
                  <div
                    key={plan.id}
                    className="p-3 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-extrabold text-gray-900 dark:text-white">
                          {plan.name}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {plan.durationDays} days · ₹
                          {plan.monthlyEquivalentRupees.toFixed(0)}/month
                        </p>
                      </div>
                      <span className="text-sm font-black text-gray-900 dark:text-white">
                        ₹{plan.priceRupees.toFixed(0)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => buyMembership(plan, 'WALLET')}
                        disabled={busy || walletTooLow}
                        title={
                          walletTooLow
                            ? 'Wallet balance does not cover this plan'
                            : undefined
                        }
                        className="px-3 py-1.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] font-extrabold disabled:opacity-40"
                      >
                        {busy && purchaseMethod === 'WALLET'
                          ? 'Paying…'
                          : 'Pay with wallet'}
                      </button>
                      <button
                        onClick={() => buyMembership(plan, 'RAZORPAY')}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold disabled:opacity-40"
                      >
                        {busy && purchaseMethod === 'RAZORPAY'
                          ? 'Opening…'
                          : 'Pay online'}
                      </button>
                    </div>

                    {walletTooLow && (
                      <p className="text-[10px] text-gray-400">
                        Wallet has ₹{balance.toFixed(2)} — not enough for this
                        plan.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-gray-400">
            Buying a paid plan while your trial is active starts the paid plan
            immediately; the remaining trial days are forfeited. Renewals extend
            from the current paid expiry. There is no auto-renewal.
          </p>
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

        <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
              Refer a friend
            </h3>
          </div>

          {referrals.loading && (
            <div className="h-16 rounded-xl bg-gray-100 dark:bg-slate-700 animate-pulse" />
          )}

          {referrals.error && (
            <ErrorState
              title="Could not load referrals"
              message={referrals.error}
              onRetry={() => void referrals.reload()}
            />
          )}

          {!referrals.loading && !referrals.error && referralData && (
            <>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-900 text-xs font-black tracking-wider text-gray-900 dark:text-white">
                  {referralData.code}
                </code>
                <button
                  onClick={copyReferralCode}
                  className="p-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  title="Copy referral code"
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                You get ₹{referralData.reward.referrerPaise / 100} and your
                friend gets ₹{referralData.reward.refereePaise / 100} in wallet
                credit after their first delivered order. You can be rewarded
                for up to {referralData.reward.maxRewardedReferrals} referrals.
              </p>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['Invited', referralData.stats.total],
                  ['Pending', referralData.stats.pending],
                  ['Rewarded', referralData.stats.rewarded],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="p-2 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200/70 dark:border-slate-700"
                  >
                    <div className="text-[9px] font-black uppercase tracking-wider text-gray-400">
                      {label}
                    </div>
                    <div className="text-sm font-black text-gray-900 dark:text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Earned so far: ₹{referralData.reward.earnedPaise / 100}
              </p>

              {referralData.referrals.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                  {referralData.referrals.slice(0, 5).map((referral) => (
                    <div
                      key={referral.id}
                      className="flex items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="text-gray-600 dark:text-slate-300 truncate">
                        {referral.referee.email || referral.referee.name || 'Invited friend'}
                      </span>
                      <span className="text-gray-400 shrink-0">
                        {REFERRAL_STATUS_LABELS[referral.status] || referral.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!hasOrders && !orders.loading && firstOrderOffer && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              First order: use{' '}
              <span className="font-black">{firstOrderOffer.code}</span> for{' '}
              {describeOffer(firstOrderOffer)}
              {firstOrderOffer.minOrderPaise > 0
                ? ` on orders above ₹${(
                    firstOrderOffer.minOrderPaise / 100
                  ).toFixed(0)}`
                : ''}
              . One use per customer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
