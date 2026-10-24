'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { SavedAddress, Order } from '../types';
import { api } from '../lib/api-client';
import { mapApiOrder } from '../lib/order-mapper';
import {
  MapPin,
  ShieldCheck,
  CreditCard,
  Wallet,
  Smartphone,
  Banknote,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CheckoutScreenProps {
  onBack: () => void;
  onOrderPlaced: (order: Order) => void;
  onOpenAuthModal?: () => void;
  activeAddress: SavedAddress;
}

type PaymentMethod = 'UPI' | 'CARD' | 'WALLET' | 'COD';

interface ServerQuote {
  itemTotal: number;
  memberDiscount: number;
  couponDiscount: number;
  couponApplied: boolean;
  couponInvalid: boolean;
  deliveryFee: number;
  packagingFee: number;
  taxes: number;
  grossTotal: number;
  walletBalanceRupees: number | null;
  walletApplied: number;
  finalPayable: number;
}

function paymentError(message: string, code: 'DISMISSED' | 'FAILED') {
  return Object.assign(new Error(message), { code });
}

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Payments are only available in the browser.'));
      return;
    }
    if ((window as any).Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Could not load the payment gateway. Check your connection and try again.'));
    document.body.appendChild(script);
  });
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  onBack,
  onOrderPlaced,
  onOpenAuthModal,
  activeAddress,
}) => {
  const { user, isAuthenticated } = useUser();
  const {
    cartItems,
    mrpTotal,
    memberSavings,
    appliedCoupon,
    taxes,
    finalTotal,
    clearCart,
    pinnedHubId,
    useWallet,
    setUseWallet,
  } = useCart();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [quote, setQuote] = useState<ServerQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);

  // The server is the source of truth for every rupee: membership, coupon
  // validity, delivery/packaging fees and the wallet cap.
  useEffect(() => {
    if (!cartItems.length) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);

    const requestedWallet =
      paymentMethod === 'WALLET' || useWallet ? user?.walletBalance ?? 0 : 0;

    api
      .quoteOrder({
        userId: user?.id,
        isMember: !!user?.isMember,
        items: cartItems.map((ci) => ({
          price: ci.item.mrp,
          memberPrice: ci.item.memberPrice,
          quantity: ci.quantity,
        })),
        couponCode: appliedCoupon?.code,
        useWalletBalance: requestedWallet,
      })
      .then((result) => {
        if (!cancelled) setQuote(result as ServerQuote);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    cartItems,
    appliedCoupon?.code,
    user?.id,
    user?.isMember,
    user?.walletBalance,
    useWallet,
    paymentMethod,
  ]);

  const display = useMemo(
    () => ({
      itemTotal: quote?.itemTotal ?? mrpTotal,
      memberSavings: quote?.memberDiscount ?? memberSavings,
      couponDiscount: quote?.couponDiscount ?? 0,
      deliveryFee: quote?.deliveryFee ?? 0,
      packagingFee: quote?.packagingFee ?? 0,
      taxes: quote?.taxes ?? taxes,
      walletApplied: quote?.walletApplied ?? 0,
      total: quote?.finalPayable ?? finalTotal,
    }),
    [quote, mrpTotal, memberSavings, taxes, finalTotal],
  );

  const walletShortfall =
    paymentMethod === 'WALLET' && quote ? Math.max(0, quote.finalPayable) : 0;
  const couponInvalid = !!quote?.couponInvalid;
  const canPlaceOrder =
    !isProcessing &&
    !quoteLoading &&
    cartItems.length > 0 &&
    !couponInvalid &&
    walletShortfall === 0;

  const handlePlaceOrder = async () => {
    if (!isAuthenticated || !user) {
      onOpenAuthModal?.();
      return;
    }

    if (!cartItems.length) {
      setCheckoutError('Your cart is empty.');
      return;
    }

    if (couponInvalid) {
      setCheckoutError(
        `Coupon '${appliedCoupon?.code}' is not valid for this cart. Remove it and try again.`,
      );
      return;
    }

    setIsProcessing(true);
    setCheckoutError(null);

    // If wallet credit covers the whole bill, settle from the wallet even when
    // the customer picked UPI/CARD — there is nothing left for a gateway.
    const effectivePaymentMethod: PaymentMethod =
      quote && quote.walletApplied > 0 && quote.finalPayable <= 0
        ? 'WALLET'
        : paymentMethod;

    let createdOrder: any = null;

    try {
      // Orders may only reference an address row owned by the buyer. The
      // storefront's local address book is provisioned idempotently here.
      const ensuredAddress = await api.addresses.ensure({
        type: activeAddress.type,
        label: activeAddress.label,
        addressLine: activeAddress.addressLine,
        landmark: activeAddress.landmark,
        city: activeAddress.city,
        pincode: activeAddress.pincode,
        lat: activeAddress.lat,
        lng: activeAddress.lng,
        isDefault: true,
      });

      const useWalletBalance =
        effectivePaymentMethod === 'WALLET' || useWallet
          ? quote?.walletBalanceRupees ?? user.walletBalance
          : 0;

      createdOrder = await api.createOrder({
        addressId: ensuredAddress.id,
        hubId: ensuredAddress.resolvedHubId || pinnedHubId || undefined,
        items: cartItems.map((ci) => ({
          menuItemId: ci.item.id,
          quantity: ci.quantity,
        })),
        couponCode: appliedCoupon?.code,
        useWalletBalance,
        paymentMethod: effectivePaymentMethod,
      });

      if (effectivePaymentMethod === 'UPI' || effectivePaymentMethod === 'CARD') {
        if (createdOrder.finalPaidPaise > 0) {
          const rzpOrder = await api.createRazorpayOrder(createdOrder.id);

          if (!rzpOrder?.key) {
            throw new Error(
              'The payment gateway is not configured. Please choose Cash on Delivery or Wallet.',
            );
          }

          await loadRazorpay();

          const paymentResponse = await new Promise<any>((resolve, reject) => {
            const options = {
              key: rzpOrder.key,
              amount: rzpOrder.amount,
              currency: rzpOrder.currency || 'INR',
              name: 'CraveOS Cloud Kitchen',
              description: 'Multi-Brand Food Order',
              order_id: rzpOrder.razorpayOrderId,
              prefill: {
                name: user.name,
                email: user.email,
                contact: user.phone,
              },
              theme: { color: '#E11D48' },
              handler: (response: any) => resolve(response),
              modal: {
                ondismiss: () =>
                  reject(paymentError('Payment was cancelled. Your order has not been placed.', 'DISMISSED')),
              },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', (response: any) =>
              reject(
                paymentError(
                  response?.error?.description || 'Payment failed. Please try again.',
                  'FAILED',
                ),
              ),
            );
            rzp.open();
          });

          try {
            await api.verifyPayment({
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
            });
          } catch (verifyErr: any) {
            // Never cancel here: the money may already have left the customer's
            // account. Ask them not to pay twice instead of minting a second order.
            throw new Error(
              `Payment was received but confirmation failed (${verifyErr?.message || 'network error'}). ` +
                `Do not pay again — contact support with order ${createdOrder.id}.`,
            );
          }
        }
      }

      const settledOrder = await api.getOrderById(createdOrder.id).catch(() => createdOrder);

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      clearCart();
      setUseWallet(false);
      onOrderPlaced(mapApiOrder(settledOrder));
    } catch (err: any) {
      // A dismissed/failed modal leaves an unpaid order behind. Cancel it so it
      // does not sit in the kitchen queue forever. Verification failures are
      // deliberately excluded — that payment may have succeeded.
      if (createdOrder && (err?.code === 'DISMISSED' || err?.code === 'FAILED')) {
        await api
          .cancelOrder(
            createdOrder.id,
            err.code === 'DISMISSED' ? 'Customer dismissed payment' : 'Payment failed',
          )
          .catch(() => undefined);
      }

      setCheckoutError(err?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const paymentOptions: { id: PaymentMethod; label: string; icon: any }[] = [
    { id: 'UPI', label: 'UPI (GPay / PhonePe)', icon: Smartphone },
    { id: 'CARD', label: 'Credit / Debit Card', icon: CreditCard },
    { id: 'WALLET', label: `Eatclub Wallet (₹${user?.walletBalance ?? 0})`, icon: Wallet },
    { id: 'COD', label: 'Cash on Delivery', icon: Banknote },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Menu</span>
      </button>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Section: Address & Payment */}
        <div className="lg:col-span-7 space-y-6">
          {/* Non-Member Free Trial Upsell Banner */}
          {(!user || !user.isMember) && mrpTotal > 0 && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white shadow-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-sm">
                  <Sparkles className="w-5 h-5 text-amber-200 shrink-0" />
                  <span>Save ₹{Math.round(mrpTotal * 0.3) + 45 + 25} with Free Trial!</span>
                </div>
                <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-white/20 uppercase tracking-wider">
                  30-Day Trial
                </span>
              </div>
              <p className="text-xs text-rose-100 leading-relaxed">
                You are paying ₹{45 + 25} in delivery & packaging fees and missing 30% member
                discount. Join EatClub Free Trial now to save ₹{Math.round(mrpTotal * 0.3) + 45 + 25}{' '}
                instantly!
              </p>
            </div>
          )}

          {/* Delivery Address Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Delivering To</h3>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                20-25 Mins SLA
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700 text-xs space-y-1">
              <span className="font-extrabold uppercase text-gray-900 dark:text-white">
                {activeAddress.label}
              </span>
              <p className="text-gray-600 dark:text-slate-300">{activeAddress.addressLine}</p>
            </div>

            {!isAuthenticated && (
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                Sign in at payment to save this address and place the order.
              </p>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Select Payment Method</h3>

            <div className="grid grid-cols-2 gap-3">
              {paymentOptions.map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                const isWalletWithoutBalance = m.id === 'WALLET' && (user?.walletBalance ?? 0) <= 0;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setPaymentMethod(m.id);
                      if (m.id === 'WALLET') setUseWallet(true);
                    }}
                    disabled={isWalletWithoutBalance}
                    className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all disabled:opacity-40 ${
                      isSelected
                        ? 'border-rose-600 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                        : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-rose-600' : 'text-gray-500'}`} />
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">{m.label}</h4>
                    </div>
                  </button>
                );
              })}
            </div>

            {paymentMethod !== 'WALLET' && (user?.walletBalance ?? 0) > 0 && (
              <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 cursor-pointer">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Use wallet balance (₹{user?.walletBalance ?? 0}) on this order
                </span>
                <input
                  type="checkbox"
                  checked={useWallet}
                  onChange={(event) => setUseWallet(event.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
              </label>
            )}

            {paymentMethod === 'WALLET' && walletShortfall > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300">
                Your wallet is ₹{walletShortfall.toFixed(0)} short. Top up or choose another payment
                method.
              </div>
            )}

            {couponInvalid && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs font-bold text-amber-800 dark:text-amber-300">
                Coupon {appliedCoupon?.code} is not valid for this cart. Remove it in the cart to
                continue.
              </div>
            )}

            {paymentMethod === 'UPI' && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <span>💡 Razorpay Test Mode UPI Notice</span>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  Real mobile banking apps (GPay, PhonePe) will reject sandbox QR codes with "Unable
                  to pay" or "QR code invalid". Inside the Razorpay popup, enter{' '}
                  <strong>
                    <code className="bg-amber-100 dark:bg-amber-900/60 px-1 rounded">
                      success@razorpay
                    </code>
                  </strong>{' '}
                  as your test UPI ID or click <strong>Simulate Success</strong>.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Order Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Order Summary</h3>

            {/* Line Items */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {cartItems.map((ci) => (
                <div key={ci.cartItemId} className="flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {ci.quantity}x {ci.item.name}
                    </span>
                    <p className="text-[10px] text-gray-400">{ci.item.brandId.toUpperCase()}</p>
                  </div>
                  <span className="font-extrabold text-gray-900 dark:text-white">
                    ₹{ci.totalPrice}
                  </span>
                </div>
              ))}
            </div>

            <div className="h-px bg-gray-200 dark:bg-slate-700" />

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>Item total (MRP)</span>
                <span>₹{display.itemTotal.toFixed(0)}</span>
              </div>
              {display.memberSavings > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Eatclub Member Savings</span>
                  <span>-₹{display.memberSavings.toFixed(0)}</span>
                </div>
              )}
              {display.couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Coupon {appliedCoupon?.code}</span>
                  <span>-₹{display.couponDiscount.toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>Delivery & Packaging</span>
                <span
                  className={
                    display.deliveryFee + display.packagingFee === 0
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : ''
                  }
                >
                  {display.deliveryFee + display.packagingFee === 0
                    ? 'FREE (₹0)'
                    : `₹${(display.deliveryFee + display.packagingFee).toFixed(0)}`}
                </span>
              </div>
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>Taxes (5% GST)</span>
                <span>₹{display.taxes.toFixed(0)}</span>
              </div>
              {display.walletApplied > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Wallet applied</span>
                  <span>-₹{display.walletApplied.toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-gray-900 dark:text-white pt-2 border-t border-gray-100 dark:border-slate-700">
                <span>Amount Payable</span>
                <span className="text-rose-600 dark:text-rose-400">
                  ₹{display.total.toFixed(0)}
                </span>
              </div>
              {quoteLoading && (
                <p className="text-[10px] text-gray-400 text-right">Recalculating totals…</p>
              )}
            </div>

            {checkoutError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
                {checkoutError}
              </div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={!canPlaceOrder}
              className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <span>Confirming Order...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    {display.total <= 0
                      ? 'Place Order'
                      : paymentMethod === 'COD'
                        ? `Place Order • Pay ₹${display.total.toFixed(0)} on Delivery`
                        : `Pay ₹${display.total.toFixed(0)} & Place Order`}
                  </span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Server-verified pricing & signed payment confirmation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
