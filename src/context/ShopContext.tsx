'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { MenuItem, SavedAddress } from '../types';
import { useUser } from './UserContext';
import { defaultViewFor, isStaff } from '../lib/roles';
import { routeForView, viewForPathname } from '../lib/routes';

interface ShopContextValue {
  /** Legacy view id for the current URL, used only for nav highlighting. */
  currentView: string;
  navigate: (view: string) => void;
  activeAddress: SavedAddress | null;
  setActiveAddress: (address: SavedAddress | null) => void;
  customizingItem: MenuItem | null;
  openItemModal: (item: MenuItem) => void;
  closeItemModal: () => void;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  isAddressModalOpen: boolean;
  openAddressModal: () => void;
  closeAddressModal: () => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  handleAuthSuccess: (user: any) => void;
  handleLogout: () => Promise<void>;
}

const ShopContext = createContext<ShopContextValue | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { login, logout, user } = useUser();

  const [activeAddress, setActiveAddress] = useState<SavedAddress | null>(null);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const currentView = useMemo(() => viewForPathname(pathname), [pathname]);

  // The signed-in customer's saved addresses are the source of truth. Without
  // this, checkout kept provisioning the demo address for every account.
  useEffect(() => {
    const saved = user?.savedAddresses;
    if (!saved || saved.length === 0) {
      // Never keep a previous account's delivery address after sign-out.
      setActiveAddress(null);
      return;
    }

    setActiveAddress((current) => {
      const sameAddress = current
        ? saved.find((address) => address.id === current.id)
        : undefined;
      if (sameAddress) return sameAddress;

      return saved.find((address) => address.isDefault) || saved[0];
    });
  }, [user?.savedAddresses]);

  const navigate = useCallback(
    (view: string) => {
      router.push(routeForView(view));
    },
    [router],
  );

  const openItemModal = useCallback((item: MenuItem) => {
    setCustomizingItem(item);
  }, []);

  const closeItemModal = useCallback(() => setCustomizingItem(null), []);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const openAddressModal = useCallback(() => setIsAddressModalOpen(true), []);
  const closeAddressModal = useCallback(() => setIsAddressModalOpen(false), []);
  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  const handleAuthSuccess = useCallback(
    (loggedUser: any) => {
      if (!loggedUser) return;
      login(loggedUser);

      // Staff who sign in from the storefront land in their console. Anyone who
      // was mid-checkout stays there so the order flow is not lost.
      if (isStaff(loggedUser) && currentView === 'home') {
        router.push(routeForView(defaultViewFor(loggedUser)));
      }
    },
    [currentView, login, router],
  );

  const handleLogout = useCallback(async () => {
    const signedOut = await logout();
    if (!signedOut) return;

    setActiveAddress(null);
    setIsCartOpen(false);
    setCustomizingItem(null);
    router.push('/');
  }, [logout, router]);

  const value = useMemo<ShopContextValue>(
    () => ({
      currentView,
      navigate,
      activeAddress,
      setActiveAddress,
      customizingItem,
      openItemModal,
      closeItemModal,
      isCartOpen,
      openCart,
      closeCart,
      isAddressModalOpen,
      openAddressModal,
      closeAddressModal,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
      handleAuthSuccess,
      handleLogout,
    }),
    [
      currentView,
      navigate,
      activeAddress,
      customizingItem,
      openItemModal,
      closeItemModal,
      isCartOpen,
      openCart,
      closeCart,
      isAddressModalOpen,
      openAddressModal,
      closeAddressModal,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
      handleAuthSuccess,
      handleLogout,
    ],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
