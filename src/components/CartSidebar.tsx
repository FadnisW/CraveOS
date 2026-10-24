'use client';

import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { X, ShoppingBag, Plus, Minus, Trash2, Tag, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToCheckout: () => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({
  isOpen,
  onClose,
  onProceedToCheckout,
}) => {
  if (!isOpen) return null;

  const { user } = useUser();
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    clearCart,
    mrpTotal,
    memberSavings,
    subtotalAfterMemberDiscount,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    deliveryFee,
    packagingFee,
    taxes,
    finalTotal,
    itemCount,
    distinctBrandsCount,
  } = useCart();

  const prospectiveSavings = Math.round(mrpTotal * 0.3) + 45 + 25;

  const [couponInput, setCouponInput] = useState<string>('');
  const [couponError, setCouponError] = useState<string>('');

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    const success = applyCoupon(couponInput);
    if (!success) {
      setCouponError('Invalid code. Try "EATCLUB100"');
    } else {
      setCouponError('');
      setCouponInput('');
    }
  };

  // Group items by brand ID
  const brandGroups = cartItems.reduce((acc, ci) => {
    const bId = ci.item.brandId;
    if (!acc[bId]) acc[bId] = [];
    acc[bId].push(ci);
    return acc;
  }, {} as Record<string, typeof cartItems>);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm">
        <div className="absolute inset-0" onClick={onClose} />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <h2 className="text-lg font-black text-gray-900 dark:text-white">Your Cart</h2>
                {itemCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                    {itemCount} items
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {itemCount > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-gray-400 hover:text-rose-600 transition-colors mr-2"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            {cartItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-500">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Your cart is empty</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs">
                  Explore our 8 cloud kitchen brands and add your favorite dishes into one single cart!
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 text-white font-extrabold text-xs shadow-md shadow-rose-600/20"
                >
                  Browse Brands
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Non-Member Free Trial Upsell Banner */}
                {(!user || !user.isMember) && mrpTotal > 0 && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-xs">
                        <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
                        <span>Save ₹{prospectiveSavings} with Free Trial!</span>
                      </div>
                      <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 uppercase tracking-wider">
                        30-Day Trial
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-100 leading-relaxed">
                      Includes 30% OFF food total + ₹0 Delivery (₹45) & Packaging (₹25) fees.
                    </p>
                  </div>
                )}
                
                {/* Multi-Brand Alert Banner */}
                {distinctBrandsCount > 1 && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Ordering from <strong>{distinctBrandsCount} Brands</strong> in 1 single trip & ₹0 delivery fee!</span>
                  </div>
                )}

                {/* Items Grouped By Brand */}
                {Object.entries(brandGroups).map(([brandId, items]) => (
                  <div key={brandId} className="space-y-3 border-b border-gray-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        {brandId}
                      </span>
                      <div className="h-px flex-1 bg-gray-200 dark:bg-slate-800" />
                    </div>

                    <div className="space-y-3">
                      {items.map((ci) => (
                        <div
                          key={ci.cartItemId}
                          className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-800"
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-sm border ${
                                ci.item.isVeg ? 'border-emerald-600 bg-emerald-600' : 'border-rose-600 bg-rose-600'
                              }`} />
                              <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">
                                {ci.item.name}
                              </h4>
                            </div>

                            {ci.selectedOptions.length > 0 && (
                              <p className="text-[10px] text-gray-500 dark:text-slate-400">
                                {ci.selectedOptions.map(o => o.optionName).join(', ')}
                              </p>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-xs font-black text-gray-900 dark:text-white">
                                ₹{ci.unitPrice * ci.quantity}
                              </span>
                              <span className="text-[10px] text-gray-400 line-through">
                                ₹{(ci.item.mrp + ci.selectedOptions.reduce((a, o) => a + o.price, 0)) * ci.quantity}
                              </span>
                            </div>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1">
                            <button
                              onClick={() => updateQuantity(ci.cartItemId, ci.quantity - 1)}
                              className="text-gray-500 hover:text-rose-600"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-bold text-gray-900 dark:text-white w-4 text-center">
                              {ci.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(ci.cartItemId, ci.quantity + 1)}
                              className="text-gray-500 hover:text-rose-600"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Coupon Code Section */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-700 dark:text-slate-300">Promo Code</span>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-600" />
                        <span>Code <strong>{appliedCoupon.code}</strong> Applied (-₹{appliedCoupon.discountValue})</span>
                      </div>
                      <button onClick={removeCoupon} className="text-gray-400 hover:text-rose-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyCoupon} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Try EATCLUB100"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-xs text-gray-900 dark:text-white border border-transparent focus:border-rose-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-extrabold"
                      >
                        Apply
                      </button>
                    </form>
                  )}
                  {couponError && <p className="text-[10px] text-rose-500">{couponError}</p>}
                </div>

                {/* Pricing Summary */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/40 border border-gray-200/80 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-500 dark:text-slate-400">
                    <span>Item Total (MRP)</span>
                    <span className="line-through">₹{mrpTotal}</span>
                  </div>

                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>Eatclub Member Discount</span>
                    <span>-₹{memberSavings}</span>
                  </div>

                  {appliedCoupon && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                      <span>Promo Coupon Discount</span>
                      <span>-₹{appliedCoupon.discountValue}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-gray-500 dark:text-slate-400">
                    <span>Delivery Fee</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">FREE (₹0)</span>
                  </div>

                  <div className="flex justify-between text-gray-500 dark:text-slate-400">
                    <span>Packaging & Platform Fee</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">FREE (₹0)</span>
                  </div>

                  <div className="flex justify-between text-gray-500 dark:text-slate-400">
                    <span>Taxes (5% GST)</span>
                    <span className="tabular-nums">₹{taxes}</span>
                  </div>

                  <div className="h-px bg-gray-200 dark:bg-slate-800 my-2" />

                  <div className="flex justify-between text-sm font-extrabold text-gray-900 dark:text-white">
                    <span>To Pay</span>
                    <span className="text-rose-600 dark:text-rose-400 tabular-nums">₹{finalTotal}</span>
                  </div>
                </div>

              </div>
            )}

            {/* Footer Checkout CTA */}
            {cartItems.length > 0 && (
              <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <button
                  onClick={() => {
                    onClose();
                    onProceedToCheckout();
                  }}
                  className="w-full py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-lg shadow-rose-600/30 flex items-center justify-between transition-colors"
                >
                  <span>Proceed to Checkout</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">₹{finalTotal}</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              </div>
            )}

          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
