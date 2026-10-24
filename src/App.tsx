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
import { AICraveAssistantModal } from './components/AICraveAssistantModal';
import { HubConflictModal } from './components/HubConflictModal';
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeScreen } from './views/HomeScreen';
import { RestaurantView } from './views/RestaurantView';
import { CheckoutScreen } from './views/CheckoutScreen';
import { OrdersScreen } from './views/OrdersScreen';
import { ProfileScreen } from './views/ProfileScreen';
import { MembershipScreen } from './views/MembershipScreen';
import { DealsScreen } from './views/DealsScreen';
import { SearchScreen } from './views/SearchScreen';
import { MenuScreen } from './views/MenuScreen';
import { AdminKDSView } from './views/AdminKDSView';
import { AdminDispatchView } from './views/AdminDispatchView';
import { AdminDashboardView } from './views/admin/AdminDashboardView';
import { AdminUserManagementView } from './views/admin/AdminUserManagementView';
import { AdminOrderManagementView } from './views/admin/AdminOrderManagementView';
import { AdminRiderManagementView } from './views/admin/AdminRiderManagementView';
import { MOCK_USER } from './data/mockData';
import { BrandId, MenuItem, Order, SavedAddress } from './types';
import { Bot, ChefHat, Bike, Shield, Users, ShoppingBag, Activity } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { login, user } = useUser();
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedBrandId, setSelectedBrandId] = useState<BrandId | null>(null);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('Pizza');
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);
  const [activeAddress, setActiveAddress] = useState<SavedAddress>(MOCK_USER.savedAddresses[0]);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // The signed-in customer's saved addresses are the source of truth. Without
  // this, checkout kept provisioning the demo address for every account.
  useEffect(() => {
    const saved = user?.savedAddresses;
    if (!saved || saved.length === 0) return;

    setActiveAddress((current) => {
      const sameAddress = saved.find((address) => address.id === current.id);
      if (sameAddress) return sameAddress;

      return saved.find((address) => address.isDefault) || saved[0];
    });
  }, [user?.savedAddresses]);

  const handleSelectBrand = (brandId: BrandId) => {
    setSelectedBrandId(brandId);
    setSelectedMenuCategory('');
    setCurrentView('menu');
  };

  const handleOrderPlaced = (order: Order) => {
    setPlacedOrder(order);
    setCurrentView('orders');
  };

  const handleAuthSuccess = (loggedUser: any, token: string) => {
    if (loggedUser && token) {
      login(loggedUser, token);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors duration-300">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAddressModal={() => setIsAddressModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        activeAddressLabel={`${activeAddress.label} • ${activeAddress.city}`}
      />

      {/* Admin Quick Switch Bar */}
      <div className="bg-slate-900 text-slate-300 py-2 px-4 text-xs flex flex-wrap items-center justify-between border-b border-slate-800 gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
          Console Mode Switcher:
        </span>
        <div className="flex flex-wrap items-center gap-3 mx-auto sm:mx-0 text-xs font-medium">
          <button
            onClick={() => setCurrentView('home')}
            className={`flex items-center gap-1.5 transition-colors ${!currentView.startsWith('admin') ? 'text-rose-400 font-bold' : 'hover:text-white'}`}
          >
            Customer App
          </button>
          <span>|</span>
          <button
            onClick={() => setCurrentView('admin-dashboard')}
            className={`flex items-center gap-1 transition-colors ${currentView === 'admin-dashboard' ? 'text-rose-400 font-bold' : 'hover:text-white'}`}
          >
            <Activity className="w-3.5 h-3.5 text-rose-500" />
            Admin Overview
          </button>
          <span>|</span>
          <button
            onClick={() => setCurrentView('admin-kds')}
            className={`flex items-center gap-1 transition-colors ${currentView === 'admin-kds' ? 'text-rose-400 font-bold' : 'hover:text-white'}`}
          >
            <ChefHat className="w-3.5 h-3.5 text-amber-400" />
            Kitchen KDS
          </button>
          <span>|</span>
          <button
            onClick={() => setCurrentView('admin-dispatch')}
            className={`flex items-center gap-1 transition-colors ${currentView === 'admin-dispatch' ? 'text-rose-400 font-bold' : 'hover:text-white'}`}
          >
            <Bike className="w-3.5 h-3.5 text-emerald-400" />
            Rider Dispatch
          </button>
          <span>|</span>
          <button
            onClick={() => setCurrentView('admin-users')}
            className={`flex items-center gap-1 transition-colors ${currentView === 'admin-users' ? 'text-rose-400 font-bold' : 'hover:text-white'}`}
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            Users
          </button>
          <span>|</span>
          <button
            onClick={() => setCurrentView('admin-orders')}
            className={`flex items-center gap-1 transition-colors ${currentView === 'admin-orders' ? 'text-rose-400 font-bold' : 'hover:text-white'}`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />
            Orders
          </button>
          <span>|</span>
          <button
            onClick={() => setCurrentView('admin-riders')}
            className={`flex items-center gap-1 transition-colors ${currentView === 'admin-riders' ? 'text-rose-400 font-bold' : 'hover:text-white'}`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            Rider KYC
          </button>
        </div>
      </div>

      {/* Main View Container (Wrapped in ErrorBoundary per SDD §2.3) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBoundary key={currentView}>
          {currentView === 'home' && (
            <HomeScreen
              onSelectBrand={handleSelectBrand}
              onOpenItemModal={setCustomizingItem}
              onNavigate={setCurrentView}
              onSelectCategory={(category) => {
                setSelectedBrandId(null);
                setSelectedMenuCategory(category);
                setCurrentView('menu');
              }}
            />
          )}

          {currentView === 'brand' && (
            <RestaurantView
              brandId={selectedBrandId || 'mojo-pizza'}
              onBack={() => setCurrentView('home')}
              onOpenItemModal={setCustomizingItem}
            />
          )}

          {currentView === 'menu' && (
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

          {currentView === 'checkout' && (
            <CheckoutScreen
              onBack={() => setCurrentView('home')}
              onOrderPlaced={handleOrderPlaced}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              activeAddress={activeAddress}
            />
          )}

          {currentView === 'orders' && (
            <OrdersScreen
              activeOrder={placedOrder}
              onBackToHome={() => setCurrentView('home')}
            />
          )}

          {currentView === 'profile' && (
            <ProfileScreen 
              onNavigate={setCurrentView} 
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {currentView === 'membership' && (
            <MembershipScreen
              onBack={() => setCurrentView('home')}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {currentView === 'deals' && (
            <DealsScreen onNavigate={setCurrentView} />
          )}

          {currentView === 'search' && (
            <SearchScreen 
              onBack={() => setCurrentView('home')}
              onOpenItemModal={setCustomizingItem}
              onSelectBrand={handleSelectBrand}
            />
          )}

          {currentView === 'admin-dashboard' && (
            <AdminDashboardView />
          )}

          {currentView === 'admin-kds' && (
            <AdminKDSView onBackToStorefront={() => setCurrentView('home')} />
          )}

          {currentView === 'admin-dispatch' && (
            <AdminDispatchView onBackToStorefront={() => setCurrentView('home')} />
          )}

          {currentView === 'admin-users' && (
            <AdminUserManagementView />
          )}

          {currentView === 'admin-orders' && (
            <AdminOrderManagementView />
          )}

          {currentView === 'admin-riders' && (
            <AdminRiderManagementView />
          )}
        </ErrorBoundary>
      </main>

      {/* Global Application Footer */}
      {!currentView.startsWith('admin') && (
        <Footer onNavigate={setCurrentView} />
      )}

      {/* Floating AI Crave Assistant Trigger Button */}
      <button
        onClick={() => setIsAIModalOpen(true)}
        className="fixed bottom-20 right-6 sm:bottom-6 sm:right-6 z-40 px-4 py-3 rounded-full bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white font-extrabold text-xs shadow-xl shadow-rose-600/30 flex items-center gap-2 hover:scale-105 transition-transform"
      >
        <Bot className="w-4 h-4 animate-bounce" />
        <span>Ask AI Crave</span>
      </button>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Cart Slide-over Sidebar */}
      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => setCurrentView('checkout')}
      />

      {/* Item Customization Modal */}
      <ItemModal
        item={customizingItem}
        onClose={() => setCustomizingItem(null)}
      />

      {/* Saved Address Modal */}
      <SavedAddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        selectedAddressId={activeAddress.id}
        onSelectAddress={setActiveAddress}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* AI Crave Assistant Modal */}
      <AICraveAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
      />

      {/* Cross-Hub Cart Conflict Modal */}
      <HubConflictModal />
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
