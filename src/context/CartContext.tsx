'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, MenuItem, CartItemOption, Coupon } from '../types';

export interface HubConflictInfo {
  newItem: MenuItem;
  newItemQuantity: number;
  newItemOptions: CartItemOption[];
  currentHubId: string;
  newHubId: string;
  currentHubName?: string;
  newHubName?: string;
}

interface CartContextType {
  cartItems: CartItem[];
  pinnedHubId: string | null;
  setPinnedHubId: (hubId: string | null) => void;
  addToCart: (item: MenuItem, quantity?: number, selectedOptions?: CartItemOption[]) => boolean;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, newQuantity: number) => void;
  clearCart: () => void;
  appliedCoupon: Coupon | null;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
  useWallet: boolean;
  setUseWallet: (use: boolean) => void;
  
  // Hub conflict state
  pendingConflict: HubConflictInfo | null;
  resolveConflict: (clearAndSwitch: boolean) => void;
  setPendingConflict: (conflict: HubConflictInfo | null) => void;
  
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

  const [pendingConflict, setPendingConflict] = useState<HubConflictInfo | null>(null);

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

  const addToCart = (item: MenuItem, quantity = 1, selectedOptions: CartItemOption[] = []): boolean => {
    // 1. Cross-Hub Conflict Guard
    // An item is compatible with the pinned hub if its availableHubIds includes that hub.
    // Only fire a conflict when the item truly cannot be served from the current hub.
    const servedByPinnedHub = pinnedHubId && item.availableHubIds.includes(pinnedHubId);
    // Resolve the best hub for this item: prefer the currently pinned hub, else fall back to the first declared hub
    const itemHub = servedByPinnedHub
      ? pinnedHubId!
      : item.availableHubIds[0] || pinnedHubId || 'hub-hsr-01';

    if (cartItems.length > 0 && pinnedHubId && !servedByPinnedHub && item.availableHubIds.length > 0) {
      setPendingConflict({
        newItem: item,
        newItemQuantity: quantity,
        newItemOptions: selectedOptions,
        currentHubId: pinnedHubId,
        newHubId: itemHub,
      });
      return false;
    }

    // Auto-pin hub if cart was empty or unpinned
    if (cartItems.length === 0 && item.availableHubIds.length > 0) {
      // Pin to the first available hub (or keep existing pinned hub if already compatible)
      if (!pinnedHubId || !item.availableHubIds.includes(pinnedHubId)) {
        setPinnedHubId(item.availableHubIds[0]);
      }
    }

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
          item,          // store original item with full availableHubIds array
          quantity,
          selectedOptions,
          unitPrice,
          totalPrice: unitPrice * quantity,
        },
      ];
    });

    return true;
  };

  const resolveConflict = (clearAndSwitch: boolean) => {
    if (!pendingConflict) return;

    if (clearAndSwitch) {
      const { newItem, newItemQuantity, newItemOptions, newHubId } = pendingConflict;
      // Clear cart, pin to the new hub, and add the pending item
      setPinnedHubId(newHubId);
      const optionsKey = newItemOptions.map(o => o.optionId).sort().join('-');
      const cartItemId = `${newItem.id}-${optionsKey}`;
      const optionsExtraCost = newItemOptions.reduce((acc, opt) => acc + opt.price, 0);
      const unitPrice = newItem.memberPrice + optionsExtraCost;

      setCartItems([
        {
          cartItemId,
          item: newItem,   // preserve full availableHubIds array
          quantity: newItemQuantity,
          selectedOptions: newItemOptions,
          unitPrice,
          totalPrice: unitPrice * newItemQuantity,
        },
      ]);
      setAppliedCoupon(null);
    }

    setPendingConflict(null);
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems(prev => {
      const nextItems = prev.filter(ci => ci.cartItemId !== cartItemId);
      return nextItems;
    });
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
        pendingConflict,
        resolveConflict,
        setPendingConflict,
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
