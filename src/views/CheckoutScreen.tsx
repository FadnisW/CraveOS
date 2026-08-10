'use client';

import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { MOCK_USER } from '../data/mockData';
import { SavedAddress, Order } from '../types';
import { api } from '../lib/api-client';
import { MapPin, ShieldCheck, CreditCard, Wallet, Smartphone, Banknote, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CheckoutScreenProps {
  onBack: () => void;
  onOrderPlaced: (order: Order) => void;
  onOpenAuthModal?: () => void;
  activeAddress: SavedAddress;
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
    subtotalAfterMemberDiscount,
    appliedCoupon,
    taxes,
    finalTotal,
    clearCart,
  } = useCart();

  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'WALLET' | 'COD'>('UPI');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handlePlaceOrder = async () => {
    // Identity Gate: Check if user is logged in
    if (!isAuthenticated) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    setIsProcessing(true);

    try {
      // Build DTO for NestJS Order Orchestrator
      const orderPayload = {
        userId: user?.id || MOCK_USER.id,
        hubId: activeAddress.resolvedHubId || 'hub-hsr-01',
        addressId: activeAddress.id,
        items: cartItems.map((ci) => ({
          menuItemId: ci.item.id,
          brandId: ci.item.brandId,
          nameSnapshot: ci.item.name,
          price: ci.item.memberPrice,
          quantity: ci.quantity,
        })),
      };

      const createdOrder = await api.createOrder(orderPayload).catch((err: any) => {
        console.warn('Backend API order creation failed or offline. Falling back to optimistic client order:', err);
        return null;
      });

      // If payment method is digital (UPI or CARD), initiate Razorpay order workflow
      if (paymentMethod === 'UPI' || paymentMethod === 'CARD') {
        try {
          const rzpOrder = await api.createRazorpayOrder(finalTotal, createdOrder?.id || 'demo_order');
          console.log('💳 Razorpay Order Created:', rzpOrder);

          // Dynamically load Razorpay SDK checkout script if not present
          if (typeof window !== 'undefined' && !(window as any).Razorpay) {
            await new Promise<void>((resolve) => {
              const script = document.createElement('script');
              script.src = 'https://checkout.razorpay.com/v1/checkout.js';
              script.onload = () => resolve();
              document.body.appendChild(script);
            });
          }

          if (typeof window !== 'undefined' && (window as any).Razorpay) {
            const options = {
              key: rzpOrder.key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_TO6NXsAXySXEqK',
              amount: rzpOrder.amount,
              currency: rzpOrder.currency || 'INR',
              name: 'CraveOS Cloud Kitchen',
              description: 'Multi-Brand Food Order',
              order_id: rzpOrder.razorpayOrderId,
              prefill: {
                name: MOCK_USER.name,
                email: MOCK_USER.email,
                contact: MOCK_USER.phone,
              },
              theme: {
                color: '#E11D48',
              },
              handler: function (response: any) {
                console.log('✅ Razorpay Payment Success Response:', response);
              },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
          }
        } catch (rzpErr) {
          console.warn('Razorpay checkout modal failed or test mode:', rzpErr);
        }
      }

      // Trigger celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      const newOrder: Order = {
        id: createdOrder?.id || `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
        createdAt: createdOrder?.createdAt ? new Date(createdOrder.createdAt).toISOString() : new Date().toISOString(),
        items: [...cartItems],
        deliveryAddress: activeAddress,
        status: createdOrder?.status || 'PLACED',
        brandStatuses: createdOrder?.brandOrders
          ? createdOrder.brandOrders.map((bo: any) => ({
              brandId: bo.brandId,
              brandName: bo.brandId.toUpperCase(),
              status: bo.status || 'ACCEPTED',
              itemsCount: bo.items?.length || 1,
            }))
          : Array.from(new Set(cartItems.map((ci) => ci.item.brandId))).map((bId) => ({
              brandId: bId,
              brandName: bId.toUpperCase(),
              status: 'ACCEPTED',
              itemsCount: cartItems.filter((ci) => ci.item.brandId === bId).length,
            })),
        mrpTotal,
        memberSavings,
        deliveryFee: 0,
        packagingFee: 0,
        platformFee: 0,
        tax: taxes,
        walletDiscount: 0,
        couponDiscount: appliedCoupon ? appliedCoupon.discountValue : 0,
        finalPaidAmount: createdOrder?.finalPaidPaise ? createdOrder.finalPaidPaise / 100 : finalTotal,
        paymentMethod,
        estimatedDeliveryMins: 22,
        rider: {
          name: 'Ramesh Kumar',
          phone: '+91 98123 45678',
          rating: 4.9,
          currentLat: 12.9150,
          currentLng: 77.6480,
        },
      };

      clearCart();
      setIsProcessing(false);
      onOrderPlaced(newOrder);
    } catch (e) {
      console.error('Error in checkout handler:', e);
      setIsProcessing(false);
    }
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
        
        {/* Left Section: Address & Payment */}
        <div className="lg:col-span-7 space-y-6">
          
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
              <span className="font-extrabold uppercase text-gray-900 dark:text-white">{activeAddress.label}</span>
              <p className="text-gray-600 dark:text-slate-300">{activeAddress.addressLine}</p>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Select Payment Method</h3>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'UPI', label: 'UPI (GPay / PhonePe)', icon: Smartphone },
                { id: 'CARD', label: 'Credit / Debit Card', icon: CreditCard },
                { id: 'WALLET', label: `Eatclub Wallet (₹${MOCK_USER.walletBalance})`, icon: Wallet },
                { id: 'COD', label: 'Cash on Delivery', icon: Banknote },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
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
                    <span className="font-bold text-gray-900 dark:text-white">{ci.quantity}x {ci.item.name}</span>
                    <p className="text-[10px] text-gray-400">{ci.item.brandId.toUpperCase()}</p>
                  </div>
                  <span className="font-extrabold text-gray-900 dark:text-white">₹{ci.totalPrice}</span>
                </div>
              ))}
            </div>

            <div className="h-px bg-gray-200 dark:bg-slate-700" />

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                <span>Eatclub Member Savings</span>
                <span>-₹{memberSavings}</span>
              </div>
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>Delivery & Packaging</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">FREE (₹0)</span>
              </div>
              <div className="flex justify-between text-gray-500 dark:text-slate-400">
                <span>Taxes (5% GST)</span>
                <span>₹{taxes}</span>
              </div>
              <div className="flex justify-between text-base font-black text-gray-900 dark:text-white pt-2 border-t border-gray-100 dark:border-slate-700">
                <span>Total Amount</span>
                <span className="text-rose-600 dark:text-rose-400">₹{finalTotal}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={isProcessing}
              className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <span>Confirming Order...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Pay ₹{finalTotal} & Place Order</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
