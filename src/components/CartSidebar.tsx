'use client';

import React from 'react';
import { useCart } from '../context/CartContext';
import { X, ShoppingBag, Plus, Minus, ArrowRight, UtensilsCrossed } from 'lucide-react';
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
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    clearCart,
    mrpTotal,
    itemCount,
    distinctBrandsCount,
  } = useCart();

  if (!isOpen) return null;

  // Group items by brand so a multi-kitchen order reads clearly.
  const brandGroups = cartItems.reduce((acc, ci) => {
    const bId = ci.item.brandName || ci.item.brandId;
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
            <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <h2 className="text-lg font-black text-gray-900 dark:text-white">Your Cart</h2>
                {itemCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
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

            {cartItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-500">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Your cart is empty</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs">
                  Add dishes from the live menu. Items from different kitchens can share one cart
                  when the same hub serves them.
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 text-white font-extrabold text-xs shadow-md shadow-rose-600/20"
                >
                  Browse the menu
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {distinctBrandsCount > 1 && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>
                      One order across <strong>{distinctBrandsCount} kitchens</strong>. Delivery and
                      fees are confirmed at checkout.
                    </span>
                  </div>
                )}

                {Object.entries(brandGroups).map(([brandName, items]) => (
                  <div key={brandName} className="space-y-3 border-b border-gray-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        {brandName.replace(/-/g, ' ')}
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
                              <span
                                className={`w-2.5 h-2.5 rounded-sm border ${
                                  ci.item.isVeg
                                    ? 'border-emerald-600 bg-emerald-600'
                                    : 'border-rose-600 bg-rose-600'
                                }`}
                              />
                              <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">
                                {ci.item.name}
                              </h4>
                            </div>

                            {ci.selectedOptions.length > 0 && (
                              <p className="text-[10px] text-gray-500 dark:text-slate-400">
                                {ci.selectedOptions.map((option) => option.optionName).join(', ')}
                              </p>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-xs font-black text-gray-900 dark:text-white">
                                ₹{ci.totalPrice}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                ₹{ci.unitPrice} each
                              </span>
                            </div>
                          </div>

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

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/40 border border-gray-200/80 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-sm font-extrabold text-gray-900 dark:text-white">
                    <span>Item total (MRP)</span>
                    <span className="tabular-nums">₹{mrpTotal}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
                    Member pricing, delivery, packaging and taxes are calculated by the server on
                    the next step. Nothing here is an estimate of the final bill.
                  </p>
                </div>
              </div>
            )}

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
                    <span className="tabular-nums">₹{mrpTotal}</span>
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
