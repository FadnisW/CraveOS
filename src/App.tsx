'use client';

import React, { useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import { UserProvider, useUser } from './context/UserContext';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CartSidebar } from './components/CartSidebar';
import { ItemModal } from './components/ItemModal';
import { SavedAddressModal } from './components/SavedAddressModal';
import { AuthModal } from './components/AuthModal';
import { HubConflictModal } from './components/HubConflictModal';
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeScreen } from './views/HomeScreen';
import { CheckoutScreen } from './views/CheckoutScreen';
import { OrdersScreen } from './views/OrdersScreen';
import { ProfileScreen } from './views/ProfileScreen';
import { SearchScreen } from './views/SearchScreen';
import { MenuScreen } from './views/MenuScreen';
import { AdminKDSView } from './views/AdminKDSView';
import { AdminDispatchView } from './views/AdminDispatchView';
import { AdminPlatformView } from './views/AdminPlatformView';
import { HubOpsView } from './views/HubOpsView';
import { BrandOpsView } from './views/BrandOpsView';
import { RiderConsoleView } from './views/RiderConsoleView';
import { AdminDashboardView } from './views/admin/AdminDashboardView';
import { AdminUserManagementView } from './views/admin/AdminUserManagementView';
import { AdminOrderManagementView } from './views/admin/AdminOrderManagementView';
import { AdminRiderManagementView } from './views/admin/AdminRiderManagementView';
import { AdminTicketsView } from './views/admin/AdminTicketsView';
import { BrandId, MenuItem, Order, SavedAddress } from './types';
import { LogOut, ShieldAlert, Store } from 'lucide-react';
import {
  canAccessView,
  consoleNavFor,
  defaultViewFor,
  isConsoleView,
  isStaff,
  roleLabel,
} from './lib/roles';

export const AppContent: React.FC = () => {
  const { login, logout, user, isMounted } = useUser();
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedBrandId, setSelectedBrandId] = useState<BrandId | null>(null);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('Pizza');
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [activeAddress, setActiveAddress] = useState<SavedAddress | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

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

  /**
   * A console view is only mountable when the role matrix allows it. Without
   * this guard the old shell rendered the KDS, dispatch, and admin screens for
   * every anonymous visitor who guessed a view name.
   */
  useEffect(() => {
    if (!isMounted) return;
    if (!isConsoleView(currentView)) return;
    if (canAccessView(currentView, user)) return;

    setCurrentView(isStaff(user) ? defaultViewFor(user) : 'home');
  }, [currentView, isMounted, user]);

  const handleSelectBrand = (brandId: BrandId) => {
    setSelectedBrandId(brandId);
    setSelectedMenuCategory('');
    setCurrentView('menu');
  };

  const handleOrderPlaced = (order: Order) => {
    setPlacedOrder(order);
    setCurrentView('orders');
  };

  const handleAuthSuccess = (loggedUser: any) => {
    if (!loggedUser) return;
    login(loggedUser);

    // Staff who sign in from the storefront land in their console. Anyone who
    // was mid-checkout stays there so the order flow is not lost.
    if (isStaff(loggedUser) && currentView === 'home') {
      setCurrentView(defaultViewFor(loggedUser));
    }
  };

  const handleLogout = async () => {
    const signedOut = await logout();
    if (!signedOut) return;

    setCurrentView('home');
    setActiveAddress(null);
    setPlacedOrder(null);
    setIsCartOpen(false);
  };

  const staff = isStaff(user);
  const navItems = consoleNavFor(user);
  const showStorefrontChrome = !isConsoleView(currentView);
  const consoleAllowed = !isConsoleView(currentView) || canAccessView(currentView, user);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors duration-300">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAddressModal={() => setIsAddressModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        activeAddressLabel={
          activeAddress
            ? `${activeAddress.label} • ${activeAddress.city}`
            : 'Select delivery address'
        }
      />

      {/* Staff console navigation. Customers never see this bar. */}
      {isMounted && staff && (
        <div className="bg-slate-900 text-slate-300 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3 overflow-x-auto">
            <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-500">
              {roleLabel(user)}
            </span>
            <span className="shrink-0 text-slate-700">|</span>

            <button
              onClick={() => setCurrentView(defaultViewFor(user))}
              className={`shrink-0 flex items-center gap-1.5 text-xs font-bold transition-colors ${
                isConsoleView(currentView) ? 'text-rose-400' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              My Console
            </button>

            {navItems.map((item) => (
              <button
                key={item.view}
                onClick={() => setCurrentView(item.view)}
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
              onClick={() => setCurrentView('home')}
              className={`shrink-0 ml-auto px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                currentView === 'home'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Storefront
            </button>
            <button
              onClick={handleLogout}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-rose-400"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Main View Container (Wrapped in ErrorBoundary per SDD §2.3) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBoundary key={currentView}>
          {!consoleAllowed && (
            <div className="max-w-lg mx-auto mt-16 p-8 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h1 className="text-lg font-black text-gray-900 dark:text-white">
                This console is not available to your account
              </h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {user
                  ? `You are signed in as ${roleLabel(user)}. Ask a super admin if you need access to this console.`
                  : 'Sign in with a staff account to open an operations console.'}
              </p>
              {!user && (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold"
                >
                  Sign in
                </button>
              )}
            </div>
          )}

          {consoleAllowed && currentView === 'home' && (
            <HomeScreen
              onSelectBrand={handleSelectBrand}
              onOpenItemModal={setCustomizingItem}
              onNavigate={setCurrentView}
              onSelectCategory={(category) => {
                setSelectedBrandId(null);
                setSelectedMenuCategory(category);
                setCurrentView('menu');
              }}
              activeAddress={activeAddress}
              onOpenAddressModal={() => setIsAddressModalOpen(true)}
            />
          )}

          {consoleAllowed && currentView === 'menu' && (
            <MenuScreen
              initialCategory={selectedMenuCategory}
              initialBrandId={selectedBrandId}
              onBack={() => {
                setSelectedBrandId(null);
                setCurrentView('home');
              }}
              onOpenItemModal={setCustomizingItem}
            />
          )}

          {consoleAllowed && currentView === 'checkout' && (
            <CheckoutScreen
              onBack={() => setCurrentView('home')}
              onOrderPlaced={handleOrderPlaced}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onOpenAddressModal={() => setIsAddressModalOpen(true)}
              activeAddress={activeAddress}
            />
          )}

          {consoleAllowed && currentView === 'orders' && (
            <OrdersScreen
              activeOrder={placedOrder}
              onBackToHome={() => setCurrentView('home')}
            />
          )}

          {consoleAllowed && currentView === 'profile' && (
            <ProfileScreen
              onNavigate={setCurrentView}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {consoleAllowed && currentView === 'search' && (
            <SearchScreen
              onBack={() => setCurrentView('home')}
              onOpenItemModal={setCustomizingItem}
              onSelectBrand={handleSelectBrand}
            />
          )}

          {consoleAllowed && currentView === 'admin-dashboard' && <AdminDashboardView />}

          {consoleAllowed && currentView === 'admin-platform' && (
            <AdminPlatformView initialTab="staff" />
          )}

          {consoleAllowed && currentView === 'admin-users' && <AdminUserManagementView />}

          {consoleAllowed && currentView === 'admin-orders' && <AdminOrderManagementView />}

          {consoleAllowed && currentView === 'admin-riders' && <AdminRiderManagementView />}

          {consoleAllowed && currentView === 'admin-tickets' && <AdminTicketsView />}

          {consoleAllowed && currentView === 'admin-finance' && (
            <AdminPlatformView initialTab="finance" />
          )}

          {consoleAllowed && currentView === 'admin-promotions' && (
            <AdminPlatformView initialTab="promotions" />
          )}

          {consoleAllowed && currentView === 'admin-audit' && (
            <AdminPlatformView initialTab="audit" />
          )}

          {consoleAllowed && currentView === 'admin-kds' && (
            <AdminKDSView onBackToStorefront={() => setCurrentView('home')} />
          )}

          {consoleAllowed && currentView === 'admin-dispatch' && (
            <AdminDispatchView onBackToStorefront={() => setCurrentView('home')} />
          )}

          {consoleAllowed && currentView === 'hub-ops' && (
            <HubOpsView onNavigate={setCurrentView} />
          )}

          {consoleAllowed && currentView === 'brand-ops' && <BrandOpsView />}

          {consoleAllowed && currentView === 'rider-console' && <RiderConsoleView />}
        </ErrorBoundary>
      </main>

      {/* Global Application Footer */}
      {showStorefrontChrome && <Footer onNavigate={setCurrentView} />}

      {/* Mobile Bottom Navigation */}
      {showStorefrontChrome && (
        <MobileBottomNav
          currentView={currentView}
          onNavigate={setCurrentView}
          onOpenCart={() => setIsCartOpen(true)}
        />
      )}

      {/* Cart Slide-over Sidebar */}
      {showStorefrontChrome && (
        <CartSidebar
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          onProceedToCheckout={() => setCurrentView('checkout')}
        />
      )}

      {/* Item Customization Modal */}
      {showStorefrontChrome && (
        <ItemModal item={customizingItem} onClose={() => setCustomizingItem(null)} />
      )}

      {/* Saved Address Modal */}
      {showStorefrontChrome && (
        <SavedAddressModal
          isOpen={isAddressModalOpen}
          onClose={() => setIsAddressModalOpen(false)}
          selectedAddressId={activeAddress?.id || ''}
          onSelectAddress={setActiveAddress}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Cross-Hub Cart Conflict Modal */}
      {showStorefrontChrome && <HubConflictModal />}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
