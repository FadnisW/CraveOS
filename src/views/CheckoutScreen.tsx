'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { SavedAddress, Order } from '../types';
import { api } from '../lib/api-client';
import { optionsPayload } from '../lib/pricing';
import { mapApiOrder } from '../lib/order-mapper';
import { loadRazorpay, openRazorpay } from '../lib/razorpay';
import {
  MapPin,
  ShieldCheck,
  CreditCard,
  Wallet,
  Smartphone,
  ArrowLeft,
  CheckCircle2,
  Tag,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CheckoutScreenProps {
  onBack: () => void;
  onOrderPlaced: (order: Order) => void;
  onOpenAuthModal?: () => void;
  onOpenAddressModal?: () => void;
  activeAddress: SavedAddress | null;
}

type PaymentMethod = 'UPI' | 'CARD' | 'WALLET';

interface ServerQuote {
  itemTotal: number;
  memberDiscount: number;
  couponDiscount: number;
  couponApplied: boolean;
  couponInvalid: boolean;
  couponMessage: string | null;
  deliveryFee: number;
  packagingFee: number;
  taxes: number;
  grossTotal: number;
  walletBalancePaise: number | null;
  walletBalanceRupees: number | null;
  walletApplied: number;
  finalPayable: number;
}

/**
 * One key per checkout attempt. A network retry of the same attempt reuses the
 * key so the API replays the order it already created instead of charging the
 * customer twice; changing the cart, address, coupon or payment method starts
 * a new attempt with a new key.
 */
function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  onBack,
  onOrderPlaced,
  onOpenAuthModal,
  onOpenAddressModal,
  activeAddress,
}) => {
  const { user, isAuthenticated } = useUser();
  const { cartItems, mrpTotal, clearCart, pinnedHubId } = useCart();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [quote, setQuote] = useState<ServerQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteAttempt, setQuoteAttempt] = useState<number>(0);
  const [couponInput, setCouponInput] = useState<string>('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [serverAddress, setServerAddress] = useState<{
    id: string;
    resolvedHubId: string;
  } | null>(null);
  const [addressResolving, setAddressResolving] = useState<boolean>(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState<string>('');

  // The profile phone is the default delivery contact, but the customer can
  // give a different number for this order. The server stores the number that
  // was actually used, so a later profile change cannot rewrite history.
  useEffect(() => {
    setContactPhone((current) => current || user?.phone || '');
  }, [user?.phone]);

  const contactPhoneValid = /^(\+91)?[6-9]\d{9}$/.test(
    contactPhone.replace(/[\s()-]/g, ''),
  );

  const idempotencyKeyRef = useRef<string>(newIdempotencyKey());
  const attemptSignature = useMemo(
    () =>
      JSON.stringify({
        addressId: activeAddress?.id || null,
        items: cartItems.map((ci) => [
          ci.item.id,
          ci.quantity,
          optionsPayload(ci.selectedOptions),
        ]),
        coupon: appliedCouponCode,
        paymentMethod,
      }),
    [activeAddress?.id, cartItems, appliedCouponCode, paymentMethod],
  );

  useEffect(() => {
    idempotencyKeyRef.current = newIdempotencyKey();
  }, [attemptSignature]);

  // A quote needs a database address: the hub, serviceability and delivery fee
  // are resolved from it. The storefront's local address book is provisioned
  // on the server before any total is requested.
  useEffect(() => {
    if (!isAuthenticated || !activeAddress) {
      setServerAddress(null);
      setAddressError(null);
      setAddressResolving(false);
      return;
    }

    let cancelled = false;
    setServerAddress(null);
    setAddressError(null);
    setAddressResolving(true);

    api.addresses
      .ensure({
        type: activeAddress.type,
        label: activeAddress.label,
        addressLine: activeAddress.addressLine,
        landmark: activeAddress.landmark,
        city: activeAddress.city,
        pincode: activeAddress.pincode,
        lat: activeAddress.lat,
        lng: activeAddress.lng,
        isDefault: true,
      })
      .then((ensured: any) => {
        if (cancelled) return;
        if (!ensured?.id || !ensured?.resolvedHubId) {
          throw new Error('This address is not inside a serviceable delivery hub.');
        }
        setServerAddress({
          id: ensured.id,
          resolvedHubId: ensured.resolvedHubId,
        });
      })
      .catch((err: any) => {
        if (!cancelled) {
          setAddressError(
            err?.message || 'Could not verify this delivery address.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setAddressResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    activeAddress?.id,
    activeAddress?.addressLine,
    activeAddress?.lat,
    activeAddress?.lng,
  ]);

  // The server is the source of truth for every rupee: membership, coupon
  // validity, delivery/packaging fees, GST and the wallet cap.
  useEffect(() => {
    if (!cartItems.length) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    if (!isAuthenticated) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    if (!serverAddress?.id) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);

    const requestedWalletPaise =
      paymentMethod === 'WALLET'
        ? Math.round((user?.walletBalance ?? 0) * 100)
        : 0;

    api
      .quoteOrder({
        addressId: serverAddress.id,
        items: cartItems.map((ci) => ({
          menuItemId: ci.item.id,
          quantity: ci.quantity,
          options: optionsPayload(ci.selectedOptions),
        })),
        couponCode: appliedCouponCode || undefined,
        useWalletBalancePaise: requestedWalletPaise,
      })
      .then((result) => {
        if (!cancelled) setQuote(result as ServerQuote);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(err?.message || 'Could not calculate the order total.');
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    cartItems,
    appliedCouponCode,
    isAuthenticated,
    serverAddress?.id,
    user?.walletBalance,
    paymentMethod,
    quoteAttempt,
  ]);

  const couponInvalid = !!quote?.couponInvalid;
  const couponApplied = !!quote?.couponApplied;

  const walletShortfall =
    paymentMethod === 'WALLET' && quote ? Math.max(0, quote.finalPayable) : 0;

  const canPlaceOrder =
    !!activeAddress &&
    !!serverAddress &&
    !addressResolving &&
    !addressError &&
    isAuthenticated &&
    !isProcessing &&
    !quoteLoading &&
    !!quote &&
    cartItems.length > 0 &&
    !couponInvalid &&
    contactPhoneValid &&
    walletShortfall === 0;

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setAppliedCouponCode(code);
    setCheckoutError(null);
  };

  const removeCoupon = () => {
    setAppliedCouponCode(null);
    setCouponInput('');
    setCheckoutError(null);
  };

  const handlePlaceOrder = async () => {
    if (!activeAddress) {
      onOpenAddressModal?.();
      return;
    }

    if (!isAuthenticated || !user) {
      onOpenAuthModal?.();
      return;
    }

    if (!cartItems.length) {
      setCheckoutError('Your cart is empty.');
      return;
    }

    if (!quote) {
      setCheckoutError('Wait for the server total before placing the order.');
      return;
    }

    if (!serverAddress) {
      setCheckoutError(
        addressError || 'Wait for the delivery address to be verified.',
      );
      return;
    }

    if (!contactPhoneValid) {
      setCheckoutError(
        'Enter the 10-digit mobile number the rider should call on delivery.',
      );
      return;
    }

    if (couponInvalid) {
      setCheckoutError(
        quote.couponMessage ||
          `Coupon '${appliedCouponCode}' is not valid for this cart. Remove it and try again.`,
      );
      return;
    }

    setIsProcessing(true);
    setCheckoutError(null);

    // If wallet credit covers the whole bill, settle from the wallet even when
    // the customer picked UPI/CARD — there is nothing left for a gateway.
    const effectivePaymentMethod: PaymentMethod =
      quote.walletApplied > 0 && quote.finalPayable <= 0 ? 'WALLET' : paymentMethod;

    let createdOrder: any = null;

    try {
      const useWalletBalancePaise =
        effectivePaymentMethod === 'WALLET'
          ? quote.walletBalancePaise ??
            Math.round((quote.walletBalanceRupees ?? user.walletBalance) * 100)
          : 0;

      createdOrder = await api.createOrder(
        {
          addressId: serverAddress.id,
          hubId: serverAddress.resolvedHubId || pinnedHubId || undefined,
          items: cartItems.map((ci) => ({
            menuItemId: ci.item.id,
            quantity: ci.quantity,
            options: optionsPayload(ci.selectedOptions),
          })),
          couponCode: appliedCouponCode || undefined,
          useWalletBalancePaise,
          paymentMethod: effectivePaymentMethod,
          contactPhone: contactPhone.trim(),
        },
        idempotencyKeyRef.current,
      );

      if (effectivePaymentMethod === 'UPI' || effectivePaymentMethod === 'CARD') {
        if (createdOrder.finalPaidPaise > 0) {
          const rzpOrder = await api.createRazorpayOrder(createdOrder.id);

          if (!rzpOrder?.key) {
            throw new Error(
              'The payment gateway is not configured. Choose Wallet or contact support.',
            );
          }

          await loadRazorpay();

          const paymentResponse = await openRazorpay({
            key: rzpOrder.key,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency || 'INR',
            orderId: rzpOrder.razorpayOrderId,
            name: 'CraveOS Cloud Kitchen',
            description: 'Multi-Brand Food Order',
            prefill: {
              name: user.name,
              email: user.email,
              contact: user.phone,
            },
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
      // The next order must never replay this one.
      idempotencyKeyRef.current = newIdempotencyKey();
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
        // The replayed order is now cancelled, so a retry needs a fresh key.
        idempotencyKeyRef.current = newIdempotencyKey();
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
  ];

  const buttonLabel = () => {
    if (isProcessing) return 'Confirming Order...';
    if (!activeAddress) return 'Add delivery address';
    if (!isAuthenticated) return 'Sign in to place order';
    if (addressResolving) return 'Verifying address…';
    if (addressError) return 'Address not serviceable';
    if (quoteLoading) return 'Calculating totals…';
    if (!quote) return 'Total unavailable';
    if (quote.finalPayable <= 0) return 'Place Order';
    return `Pay ₹${quote.finalPayable.toFixed(0)} & Place Order`;
  };

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
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Delivering To</h3>
              </div>
              {onOpenAddressModal && (
                <button
                  onClick={onOpenAddressModal}
                  className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400"
                >
                  {activeAddress ? 'Change' : 'Add address'}
                </button>
              )}
            </div>

            {activeAddress ? (
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700 text-xs space-y-1">
                <span className="font-extrabold uppercase text-gray-900 dark:text-white">
                  {activeAddress.label}
                </span>
                <p className="text-gray-600 dark:text-slate-300">{activeAddress.addressLine}</p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-dashed border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                <p className="font-extrabold">Add a delivery address to continue.</p>
                <p>
                  The hub is resolved from the address. Delivery availability is checked against
                  that hub's service area.
                </p>
                {onOpenAddressModal && (
                  <button
                    onClick={onOpenAddressModal}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold"
                  >
                    Add delivery address
                  </button>
                )}
              </div>
            )}

            {activeAddress && addressResolving && (
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                Checking delivery availability…
              </p>
            )}

            {activeAddress && addressError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300 space-y-2">
                <p>{addressError}</p>
                {onOpenAddressModal && (
                  <button
                    onClick={onOpenAddressModal}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-extrabold"
                  >
                    Choose another address
                  </button>
                )}
              </div>
            )}

            {activeAddress && serverAddress?.resolvedHubId && (
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                Served by {serverAddress.resolvedHubId}
              </p>
            )}

            <div className="pt-3 border-t border-gray-100 dark:border-slate-700 space-y-1.5">
              <label
                htmlFor="checkout-contact-phone"
                className="text-xs font-bold text-gray-700 dark:text-slate-300"
              >
                Delivery contact number
              </label>
              <input
                id="checkout-contact-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-xs text-gray-900 dark:text-white border border-transparent focus:border-rose-500 focus:outline-none"
              />
              <p className="text-[10px] text-gray-500 dark:text-slate-400">
                {contactPhone && !contactPhoneValid
                  ? 'Enter a valid 10-digit Indian mobile number.'
                  : 'The rider will call this number on arrival. It is stored with this order.'}
              </p>
            </div>

            {!isAuthenticated && (
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                Sign in to verify this address and see the server total.
              </p>
            )}
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Select Payment Method</h3>

            <div className="grid grid-cols-2 gap-3">
              {paymentOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = paymentMethod === option.id;
                const isWalletWithoutBalance =
                  option.id === 'WALLET' && (user?.walletBalance ?? 0) <= 0;

                return (
                  <button
                    key={option.id}
                    onClick={() => setPaymentMethod(option.id)}
                    disabled={isWalletWithoutBalance}
                    className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all disabled:opacity-40 ${
                      isSelected
                        ? 'border-rose-600 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                        : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 hover:bg-gray-100'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 ${isSelected ? 'text-rose-600' : 'text-gray-500'}`}
                    />
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">{option.label}</h4>
                    </div>
                  </button>
                );
              })}
            </div>

            {paymentMethod === 'WALLET' && walletShortfall > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300">
                Your wallet is ₹{walletShortfall.toFixed(0)} short. Top up or choose another payment
                method.
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-700">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300">
                Promo code
              </label>

              {appliedCouponCode ? (
                <div className="space-y-1.5">
                  <div
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold ${
                      couponInvalid
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      {appliedCouponCode}
                      {quoteLoading && <span className="font-normal">checking…</span>}
                      {!quoteLoading && couponApplied && (
                        <span>-₹{quote?.couponDiscount.toFixed(0)}</span>
                      )}
                    </span>
                    <button onClick={removeCoupon} className="text-gray-400 hover:text-rose-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {!quoteLoading && couponInvalid && quote?.couponMessage && (
                    <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                      {quote.couponMessage}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter a code"
                    value={couponInput}
                    onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-xs text-gray-900 dark:text-white border border-transparent focus:border-rose-500 focus:outline-none"
                  />
                  <button
                    onClick={applyCoupon}
                    disabled={!couponInput.trim()}
                    className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-extrabold disabled:opacity-40"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Order Summary</h3>

            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {cartItems.map((ci) => (
                <div key={ci.cartItemId} className="flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {ci.quantity}x {ci.item.name}
                    </span>
                    <p className="text-[10px] text-gray-400">
                      {(ci.item.brandName || ci.item.brandId).toUpperCase()}
                    </p>
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
                <span>₹{(quote?.itemTotal ?? mrpTotal).toFixed(0)}</span>
              </div>

              {quote && quote.memberDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Eatclub Member Savings</span>
                  <span>-₹{quote.memberDiscount.toFixed(0)}</span>
                </div>
              )}

              {quote && quote.couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Coupon {appliedCouponCode}</span>
                  <span>-₹{quote.couponDiscount.toFixed(0)}</span>
                </div>
              )}

              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>Delivery &amp; Packaging</span>
                <span>
                  {quote
                    ? `₹${(quote.deliveryFee + quote.packagingFee).toFixed(0)}`
                    : quoteLoading
                      ? 'Calculating…'
                      : '—'}
                </span>
              </div>

              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>Taxes</span>
                <span>{quote ? `₹${quote.taxes.toFixed(0)}` : '—'}</span>
              </div>

              {quote && quote.walletApplied > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Wallet applied</span>
                  <span>-₹{quote.walletApplied.toFixed(0)}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-black text-gray-900 dark:text-white pt-2 border-t border-gray-100 dark:border-slate-700">
                <span>Amount Payable</span>
                <span className="text-rose-600 dark:text-rose-400">
                  {quote ? `₹${quote.finalPayable.toFixed(0)}` : '—'}
                </span>
              </div>

              {quoteLoading && (
                <p className="text-[10px] text-gray-400 text-right">Recalculating totals…</p>
              )}
            </div>

            {quoteError && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs font-bold text-amber-800 dark:text-amber-300 space-y-2">
                <p>{quoteError}</p>
                <button
                  onClick={() => setQuoteAttempt((attempt) => attempt + 1)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-extrabold"
                >
                  Try again
                </button>
              </div>
            )}

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
              <CheckCircle2 className="w-5 h-5" />
              <span>{buttonLabel()}</span>
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Server-verified pricing &amp; signed payment confirmation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
