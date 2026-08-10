import React, { useState } from 'react';
import { TabType, Restaurant, FoodItem, CartItem, Coupon, Address, Order, UserProfile } from './types';
import { 
  RESTAURANTS, 
  FOOD_ITEMS, 
  TOP_OFFERS, 
  COUPONS, 
  INITIAL_ORDERS, 
  INITIAL_ADDRESSES, 
  USER_PROFILE 
} from './data/mockData';

import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Footer } from './components/Footer';
import { CartSidebar } from './components/CartSidebar';
import { ItemModal } from './components/ItemModal';
import { SavedAddressModal } from './components/SavedAddressModal';
import { Toast } from './components/Toast';

import { HomeScreen } from './views/HomeScreen';
import { SearchScreen } from './views/SearchScreen';
import { DealsScreen } from './views/DealsScreen';
import { OrdersScreen } from './views/OrdersScreen';
import { ProfileScreen } from './views/ProfileScreen';
import { RestaurantView } from './views/RestaurantView';
import { CheckoutScreen } from './views/CheckoutScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState<FoodItem | null>(null);
  
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfile>(USER_PROFILE);
  const [addresses, setAddresses] = useState<Address[]>(INITIAL_ADDRESSES);
  const [selectedAddress, setSelectedAddress] = useState<Address>(INITIAL_ADDRESSES[0]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSelectRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setActiveTab('restaurant');
  };

  const handleAddToCart = (newItem: CartItem) => {
    setCartItems(prev => {
      const existingIdx = prev.findIndex(
        i => i.foodItem.id === newItem.foodItem.id && 
             i.selectedPortion?.name === newItem.selectedPortion?.name
      );
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += newItem.quantity;
        return updated;
      }
      return [...prev, newItem];
    });
    showToast(`Added ${newItem.foodItem.name} to cart`);
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    setCartItems(prev => {
      const updated = [...prev];
      updated[index].quantity += delta;
      if (updated[index].quantity <= 0) {
        updated.splice(index, 1);
      }
      return updated;
    });
  };

  const handleApplyCouponCode = (code: string): boolean => {
    const found = COUPONS.find(c => c.code.toUpperCase() === code.toUpperCase());
    if (found) {
      setAppliedCoupon(found);
      showToast(`Coupon ${found.code} applied successfully!`);
      return true;
    }
    return false;
  };

  const handleCopyCoupon = (code: string) => {
    handleApplyCouponCode(code);
  };

  const handlePlaceOrderSuccess = () => {
    const newOrder: Order = {
      id: `EC-${Math.floor(100000 + Math.random() * 900000)}`,
      restaurantName: selectedRestaurant ? selectedRestaurant.name : 'EatClub Delights',
      restaurantImage: selectedRestaurant?.image,
      itemsSummary: cartItems.map(i => `${i.quantity}x ${i.foodItem.name}`).join(', '),
      date: 'Just now',
      itemCount: cartItems.reduce((s, i) => s + i.quantity, 0),
      totalPrice: cartItems.reduce((s, i) => s + i.totalPrice * i.quantity, 0),
      status: 'On the way',
      active: true,
      etaMinutes: 20,
      driverName: 'Alex Mercer',
      driverRating: '4.9 ★',
      driverPhone: '+1 (555) 987-6543',
    };

    setOrders(prev => [newOrder, ...prev.map(o => ({ ...o, active: false }))]);
    setCartItems([]);
    setAppliedCoupon(null);
    setActiveTab('orders');
    showToast('🎉 Order placed successfully!');
  };

  const handleReorder = (order: Order) => {
    // Add sample items
    const sampleItem = FOOD_ITEMS[0];
    handleAddToCart({
      foodItem: sampleItem,
      quantity: 1,
      totalPrice: sampleItem.price,
    });
    setIsCartOpen(true);
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0);

  const bestsellers = FOOD_ITEMS.filter(i => i.isBestseller);

  return (
    <div className="min-h-screen bg-[#f7fafa] text-[#181c1d] flex flex-col font-['Inter',sans-serif]">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        selectedAddress={selectedAddress}
        onOpenAddressModal={() => setIsAddressModalOpen(true)}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'home' && (
          <HomeScreen
            restaurants={RESTAURANTS}
            topOffers={TOP_OFFERS}
            bestsellers={bestsellers}
            onSelectRestaurant={handleSelectRestaurant}
            onSelectItem={(item) => setSelectedItemForModal(item)}
            setActiveTab={setActiveTab}
            onCopyCoupon={handleCopyCoupon}
          />
        )}

        {activeTab === 'search' && (
          <SearchScreen
            foodItems={FOOD_ITEMS}
            restaurants={RESTAURANTS}
            onSelectItem={(item) => setSelectedItemForModal(item)}
            onSelectRestaurant={handleSelectRestaurant}
          />
        )}

        {activeTab === 'deals' && (
          <DealsScreen
            coupons={COUPONS}
            onCopyCoupon={handleCopyCoupon}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersScreen
            orders={orders}
            onReorder={handleReorder}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            userProfile={userProfile}
            onUpdateProfile={setUserProfile}
            addresses={addresses}
            onOpenAddressModal={() => setIsAddressModalOpen(true)}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'restaurant' && selectedRestaurant && (
          <RestaurantView
            restaurant={selectedRestaurant}
            foodItems={FOOD_ITEMS}
            onSelectItem={(item) => setSelectedItemForModal(item)}
            onBack={() => setActiveTab('home')}
            cartCount={cartCount}
            cartTotal={cartTotal}
            onOpenCart={() => setIsCartOpen(true)}
          />
        )}

        {activeTab === 'checkout' && (
          <CheckoutScreen
            cartItems={cartItems}
            selectedAddress={selectedAddress}
            onOpenAddressModal={() => setIsAddressModalOpen(true)}
            appliedCoupon={appliedCoupon}
            onApplyCouponCode={handleApplyCouponCode}
            onRemoveCoupon={() => setAppliedCoupon(null)}
            onPlaceOrderSuccess={handlePlaceOrderSuccess}
            onBack={() => setActiveTab('home')}
            setActiveTab={setActiveTab}
          />
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasActiveOrder={orders.some(o => o.active)}
      />

      {/* Cart Sidebar Drawer */}
      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        appliedCoupon={appliedCoupon}
        onRemoveCoupon={() => setAppliedCoupon(null)}
        onApplyCouponCode={handleApplyCouponCode}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setActiveTab('checkout');
        }}
      />

      {/* Item Customization Modal */}
      <ItemModal
        item={selectedItemForModal}
        isOpen={!!selectedItemForModal}
        onClose={() => setSelectedItemForModal(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Saved Address Modal */}
      <SavedAddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        addresses={addresses}
        selectedAddress={selectedAddress}
        onSelectAddress={setSelectedAddress}
        onAddAddress={(newAddr) => setAddresses(prev => [...prev, newAddr])}
      />

      {/* Toast Notification */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
