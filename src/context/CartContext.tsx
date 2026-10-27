'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, MenuItem, CartItemOption } from '../types';

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

  // Hub conflict state
  pendingConflict: HubConflictInfo | null;
  resolveConflict: (clearAndSwitch: boolean) => void;
  setPendingConflict: (conflict: HubConflictInfo | null) => void;

  /**
   * Item count and MRP only. Member pricing, coupons, delivery, packaging and
   * taxes are all decided by the server quote at checkout — the cart must not
   * guess at them, because a guess the server disagrees with is a fake total.
   */
  mrpTotal: number;
  itemCount: number;
  distinctBrandsCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function optionsKey(selectedOptions: CartItemOption[]) {
  return selectedOptions.map((option) => option.optionId).sort().join('-');
}

function unitPriceFor(item: MenuItem, selectedOptions: CartItemOption[]) {
  const optionsExtraCost = selectedOptions.reduce((sum, option) => sum + option.price, 0);
  return item.mrp + optionsExtraCost;
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // No default hub. An unpinned cart is honest: the hub is resolved from the
  // delivery address when the customer picks one.
  const [pinnedHubId, setPinnedHubId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('eatclub_pinned_hub') || null;
  });

  const [pendingConflict, setPendingConflict] = useState<HubConflictInfo | null>(null);

  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    // Guard against SSR — localStorage is only available in the browser
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('eatclub_cart');
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('eatclub_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (pinnedHubId) {
      localStorage.setItem('eatclub_pinned_hub', pinnedHubId);
    } else {
      localStorage.removeItem('eatclub_pinned_hub');
    }
  }, [pinnedHubId]);

  const addToCart = (
    item: MenuItem,
    quantity = 1,
    selectedOptions: CartItemOption[] = [],
  ): boolean => {
    // Cross-hub conflict guard. An item is compatible with the pinned hub when
    // its live hub list includes that hub. If the item has no live hub at all
    // the cart still accepts it; checkout will surface the server's error.
    const servedByPinnedHub = !!pinnedHubId && item.availableHubIds.includes(pinnedHubId);
    const itemHub = servedByPinnedHub ? pinnedHubId : item.availableHubIds[0] || null;

    if (
      cartItems.length > 0 &&
      pinnedHubId &&
      !servedByPinnedHub &&
      item.availableHubIds.length > 0 &&
      itemHub
    ) {
      setPendingConflict({
        newItem: item,
        newItemQuantity: quantity,
        newItemOptions: selectedOptions,
        currentHubId: pinnedHubId,
        newHubId: itemHub,
        currentHubName: cartItems[0]?.item.availableHubNames?.[pinnedHubId],
        newHubName: item.availableHubNames?.[itemHub],
      });
      return false;
    }

    // Pin the first real hub only when the cart is empty.
    if (cartItems.length === 0 && item.availableHubIds.length > 0) {
      if (!pinnedHubId || !item.availableHubIds.includes(pinnedHubId)) {
        setPinnedHubId(item.availableHubIds[0]);
      }
    }

    const key = optionsKey(selectedOptions);
    const cartItemId = `${item.id}-${key}`;
    const unitPrice = unitPriceFor(item, selectedOptions);

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((ci) => ci.cartItemId === cartItemId);
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

    return true;
  };

  const resolveConflict = (clearAndSwitch: boolean) => {
    if (!pendingConflict) return;

    if (clearAndSwitch) {
      const { newItem, newItemQuantity, newItemOptions, newHubId } = pendingConflict;
      const unitPrice = unitPriceFor(newItem, newItemOptions);

      setPinnedHubId(newHubId);
      setCartItems([
        {
          cartItemId: `${newItem.id}-${optionsKey(newItemOptions)}`,
          item: newItem,
          quantity: newItemQuantity,
          selectedOptions: newItemOptions,
          unitPrice,
          totalPrice: unitPrice * newItemQuantity,
        },
      ]);
    }

    setPendingConflict(null);
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    setCartItems((prev) =>
      prev.map((ci) =>
        ci.cartItemId === cartItemId
          ? { ...ci, quantity: newQuantity, totalPrice: ci.unitPrice * newQuantity }
          : ci,
      ),
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const itemCount = cartItems.reduce((acc, ci) => acc + ci.quantity, 0);
  const distinctBrandsCount = new Set(cartItems.map((ci) => ci.item.brandId)).size;
  const mrpTotal = cartItems.reduce((acc, ci) => acc + ci.totalPrice, 0);

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
        pendingConflict,
        resolveConflict,
        setPendingConflict,
        mrpTotal,
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
