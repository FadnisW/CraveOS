'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeProvider } from '../../context/ThemeContext';
import { CartProvider } from '../../context/CartContext';
import { UserProvider, useUser } from '../../context/UserContext';
import { ShopProvider, useShop } from '../../context/ShopContext';
import { Navbar } from '../Navbar';
import { MobileBottomNav } from '../MobileBottomNav';
import { CartSidebar } from '../CartSidebar';
import { ItemModal } from '../ItemModal';
import { SavedAddressModal } from '../SavedAddressModal';
import { AuthModal } from '../AuthModal';
import { HubConflictModal } from '../HubConflictModal';
import { Footer } from '../Footer';
import { ErrorBoundary } from '../ErrorBoundary';
import { LogOut, Store } from 'lucide-react';
import {
  consoleNavFor,
  defaultViewFor,
  isStaff,
  roleLabel,
} from '../../lib/roles';
import { routeForView } from '../../lib/routes';

const StaffBar: React.FC = () => {
  const router = useRouter();
  const { user, isMounted } = useUser();
  const { currentView, navigate, handleLogout } = useShop();

  if (!isMounted || !isStaff(user)) return null;

  const navItems = consoleNavFor(user);

  return (
    <div className="bg-slate-900 text-slate-300 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3 overflow-x-auto">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-500">
          {roleLabel(user)}
        </span>
        <span className="shrink-0 text-slate-700">|</span>

        <button
          onClick={() => router.push(routeForView(defaultViewFor(user)))}
          className={`shrink-0 flex items-center gap-1.5 text-xs font-bold transition-colors ${
            currentView.startsWith('admin-') || currentView.endsWith('-ops') || currentView === 'rider-console'
              ? 'text-rose-400'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          My Console
        </button>

        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => navigate(item.view)}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
              currentView === item.view
                ? 'bg-rose-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title={item.label}
          >
            {item.shortLabel}
          </button>
        ))}

        <button
          onClick={() => router.push('/')}
          className={`shrink-0 ml-auto px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
            currentView === 'home'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          Storefront
        </button>
        <button
          onClick={() => void handleLogout()}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-rose-400"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
};

const ShopChrome: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const {
    currentView,
    navigate,
    activeAddress,
    customizingItem,
    closeItemModal,
    isCartOpen,
    openCart,
    closeCart,
    isAddressModalOpen,
    closeAddressModal,
    isAuthModalOpen,
    closeAuthModal,
    handleAuthSuccess,
    setActiveAddress,
    openAddressModal,
    openAuthModal,
  } = useShop();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors duration-300">
      <Navbar
        currentView={currentView}
        onNavigate={navigate}
        onOpenCart={openCart}
        onOpenAddressModal={openAddressModal}
        onOpenAuthModal={openAuthModal}
        activeAddressLabel={
          activeAddress
            ? `${activeAddress.label} · ${activeAddress.city}`
            : 'Select delivery address'
        }
      />

      <StaffBar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
      </main>

      <Footer onNavigate={navigate} />

      <MobileBottomNav
        currentView={currentView}
        onNavigate={navigate}
        onOpenCart={openCart}
      />

      <CartSidebar
        isOpen={isCartOpen}
        onClose={closeCart}
        onProceedToCheckout={() => {
          closeCart();
          navigate('checkout');
        }}
      />

      <ItemModal item={customizingItem} onClose={closeItemModal} />

      <SavedAddressModal
        isOpen={isAddressModalOpen}
        onClose={closeAddressModal}
        selectedAddressId={activeAddress?.id || ''}
        onSelectAddress={setActiveAddress}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onSuccess={handleAuthSuccess}
      />

      <HubConflictModal />
    </div>
  );
};

/**
 * Storefront shell. Providers live in a layout so cart, session, theme and the
 * selected address survive client-side route changes instead of resetting on
 * every navigation.
 */
export const ShopShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <ThemeProvider>
      <UserProvider>
        <CartProvider>
          <ShopProvider>
            <ShopChrome>{children}</ShopChrome>
          </ShopProvider>
        </CartProvider>
      </UserProvider>
    </ThemeProvider>
  );
};
