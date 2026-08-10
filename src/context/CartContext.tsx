'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, MenuItem, CartItemOption, Coupon } from '../types';

interface CartContextType {
  cartItems: CartItem[];
  pinnedHubId: string | null;
  setPinnedHubId: (hubId: string | null) => void;
  addToCart: (item: MenuItem, quantity?: number, selectedOptions?: CartItemOption[]) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, newQuantity: number) => void;
  clearCart: () => void;
  appliedCoupon: Coupon | null;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
  useWallet: boolean;
  setUseWallet: (use: boolean) => void;
  
  // Pricing metrics
  mrpTotal: number;
  memberSavings: number;
  subtotalAfterMemberDiscount: number;
  couponDiscount: number;
  deliveryFee: number;
  packagingFee: number;
  platformFee: number;
  taxes: number;
  finalTotal: number;
  itemCount: number;
  distinctBrandsCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pinnedHubId, setPinnedHubId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return 'hub-hsr-01';
    return localStorage.getItem('eatclub_pinned_hub') || 'hub-hsr-01';
  });

  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    // Guard against SSR — localStorage is only available in the browser
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('eatclub_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [useWallet, setUseWallet] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('eatclub_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (pinnedHubId) {
      localStorage.setItem('eatclub_pinned_hub', pinnedHubId);
    }
  }, [pinnedHubId]);

  const addToCart = (item: MenuItem, quantity = 1, selectedOptions: CartItemOption[] = []) => {
    // Generate unique ID for this line item + customization combination
    const optionsKey = selectedOptions.map(o => o.optionId).sort().join('-');
    const cartItemId = `${item.id}-${optionsKey}`;

    const optionsExtraCost = selectedOptions.reduce((acc, opt) => acc + opt.price, 0);
    const unitPrice = item.memberPrice + optionsExtraCost;

    setCartItems(prev => {
      const existingIndex = prev.findIndex(ci => ci.cartItemId === cartItemId);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          totalPrice: unitPrice * newQty,
        };
        return updated;
      }

      return [
        ...prev,
        {
          cartItemId,
          item,
          quantity,
          selectedOptions,
          unitPrice,
          totalPrice: unitPrice * quantity,
        },
      ];
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems(prev => prev.filter(ci => ci.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    setCartItems(prev =>
      prev.map(ci => {
        if (ci.cartItemId === cartItemId) {
          return {
            ...ci,
            quantity: newQuantity,
            totalPrice: ci.unitPrice * newQuantity,
          };
        }
        return ci;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setAppliedCoupon(null);
  };

  const applyCoupon = (code: string): boolean => {
    // Basic coupon mock evaluation
    if (code.toUpperCase() === 'EATCLUB100') {
      setAppliedCoupon({
        code: 'EATCLUB100',
        description: 'Flat ₹100 OFF',
        discountType: 'flat',
        discountValue: 100,
        minOrderValue: 399,
      });
      return true;
    }
    return false;
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  // Calculations
  const itemCount = cartItems.reduce((acc, ci) => acc + ci.quantity, 0);

  const distinctBrands = new Set(cartItems.map(ci => ci.item.brandId));
  const distinctBrandsCount = distinctBrands.size;

  const mrpTotal = cartItems.reduce((acc, ci) => {
    const optsPrice = ci.selectedOptions.reduce((a, o) => a + o.price, 0);
    return acc + (ci.item.mrp + optsPrice) * ci.quantity;
  }, 0);

  const subtotalAfterMemberDiscount = cartItems.reduce((acc, ci) => acc + ci.totalPrice, 0);

  const memberSavings = mrpTotal - subtotalAfterMemberDiscount;

  let couponDiscount = 0;
  if (appliedCoupon && subtotalAfterMemberDiscount >= appliedCoupon.minOrderValue) {
    couponDiscount = appliedCoupon.discountValue;
  }

  // CraveOS Guarantee: ₹0 Delivery, ₹0 Packaging, ₹0 Platform Fee for Eatclub Members
  const deliveryFee = 0;
  const packagingFee = 0;
  const platformFee = 0;
  const taxes = Math.round(subtotalAfterMemberDiscount * 0.05); // 5% GST

  const finalTotal = Math.max(0, subtotalAfterMemberDiscount - couponDiscount + taxes);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        pinnedHubId,
        setPinnedHubId,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        useWallet,
        setUseWallet,
        mrpTotal,
        memberSavings,
        subtotalAfterMemberDiscount,
        couponDiscount,
        deliveryFee,
        packagingFee,
        platformFee,
        taxes,
        finalTotal,
        itemCount,
        distinctBrandsCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
