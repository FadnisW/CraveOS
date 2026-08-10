import React from 'react';
import { CartItem, Coupon } from '../types';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  appliedCoupon: Coupon | null;
  onRemoveCoupon: () => void;
  onApplyCouponCode: (code: string) => boolean;
  onProceedToCheckout: () => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  appliedCoupon,
  onRemoveCoupon,
  onApplyCouponCode,
  onProceedToCheckout,
}) => {
  const [couponInput, setCouponInput] = React.useState('');
  const [couponError, setCouponError] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0);

  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discountText.includes('50%')) {
      discountAmount = Math.min(subtotal * 0.5, appliedCoupon.maxDiscount || 150);
    } else if (appliedCoupon.discountText.includes('Flat ₹150')) {
      discountAmount = 150;
    } else if (appliedCoupon.discountText.includes('Flat ₹50')) {
      discountAmount = 50;
    } else if (appliedCoupon.discountText.includes('60%')) {
      discountAmount = Math.min(subtotal * 0.6, appliedCoupon.maxDiscount || 120);
    } else {
      discountAmount = 30;
    }
  }

  const deliveryFee = subtotal > 300 ? 0 : 29;
  const taxes = Math.round(subtotal * 0.05);
  const grandTotal = Math.max(0, subtotal - discountAmount + deliveryFee + taxes);

  const handleApplyClick = () => {
    setCouponError(null);
    if (!couponInput.trim()) return;
    const success = onApplyCouponCode(couponInput.trim().toUpperCase());
    if (!success) {
      setCouponError('Invalid coupon code. Try FIRST3, MEGA150, or EAT60');
    } else {
      setCouponInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#121212] border-l border-white/10 shadow-2xl flex flex-col text-[#FDFCF5]">
          {/* Cart Header */}
          <div className="p-5 sm:p-6 bg-[#1A1A1A] border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#C5A059] text-2xl">shopping_bag</span>
              <h2 className="text-lg font-serif-display font-bold text-[#FDFCF5]">Your Selection</h2>
              <span className="bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30 text-[10px] uppercase tracking-widest font-bold px-2.5 py-0.5 rounded-full">
                {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <img 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBqXWdmXIXT1gcn9kVKgXJVXISOfndoKVMlTKxkAk_-wgMyx-9WZiC-1u5KoZGfOqVtrGDmmmMuvKYaXy2IAK_EHCYe-kjiUxzQh9rDukG9YNUPXce-pfpJUHet5JwpezlgbbBlqcJatMLha4FiyT2f9rmG3SW5gdq6_krpW0_Q4F5hPF5T__6osqgidOxxpqGGK1lvA2uMTICk3ub9skjFP1KjI13v2F0WE10agJMV_qgtQIjg8vl85Q" 
                  alt="Empty Basket"
                  className="w-40 h-40 object-contain drop-shadow-md opacity-80 filter grayscale hover:grayscale-0 transition-all"
                />
                <div>
                  <h3 className="text-lg font-serif-display font-bold text-[#FDFCF5]">Your selection is empty</h3>
                  <p className="text-xs text-white/50 mt-1 max-w-xs font-light">
                    Explore curated culinary creations from our premier partner kitchens and add your selections.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="bg-[#C5A059] hover:bg-[#d8b268] text-[#0F0F0F] px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest transition-all shadow-md"
                >
                  Explore Collection
                </button>
              </div>
            ) : (
              <>
                {/* Cart Items List */}
                <div className="space-y-4">
                  {cartItems.map((item, idx) => (
                    <div 
                      key={idx}
                      className="flex items-start justify-between gap-3 p-3.5 bg-[#1A1A1A] rounded-xl border border-white/10"
                    >
                      <img 
                        src={item.foodItem.image} 
                        alt={item.foodItem.name} 
                        className="w-16 h-16 rounded-lg object-cover shrink-0 border border-white/10"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-3 h-3 rounded-xs border flex items-center justify-center shrink-0 ${
                            item.foodItem.isVeg ? 'border-emerald-500' : 'border-rose-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              item.foodItem.isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                            }`} />
                          </span>
                          <h4 className="text-xs font-bold text-[#FDFCF5] truncate">
                            {item.foodItem.name}
                          </h4>
                        </div>
                        {item.selectedPortion && (
                          <div className="text-[11px] text-white/50 mt-0.5 font-light">
                            Portion: {item.selectedPortion.name}
                          </div>
                        )}
                        {item.selectedAddons && item.selectedAddons.length > 0 && (
                          <div className="text-[11px] text-white/50 mt-0.5 font-light">
                            Addons: {item.selectedAddons.map(a => a.name).join(', ')}
                          </div>
                        )}
                        <div className="text-xs font-bold text-[#C5A059] mt-1 font-serif">
                          ₹{item.totalPrice * item.quantity}
                        </div>
                      </div>

                      {/* Quantity Controller */}
                      <div className="flex items-center border border-white/20 rounded-lg bg-[#222222] overflow-hidden">
                        <button
                          onClick={() => onUpdateQuantity(idx, -1)}
                          className="px-2 py-1 text-white/70 hover:bg-white/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">remove</span>
                        </button>
                        <span className="px-2.5 text-xs font-bold text-[#FDFCF5]">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(idx, 1)}
                          className="px-2 py-1 text-white/70 hover:bg-white/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coupon Input / Applied Badge */}
                <div className="p-4 bg-[#1A1A1A] rounded-xl border border-[#C5A059]/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[#C5A059] text-xs font-bold uppercase tracking-wider">
                      <span className="material-symbols-outlined text-base">confirmation_number</span>
                      <span>Privilege Passes</span>
                    </div>
                  </div>

                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-[#222222] p-2.5 rounded-lg border border-[#C5A059]/40">
                      <div>
                        <span className="text-xs font-bold text-[#0F0F0F] bg-[#C5A059] px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {appliedCoupon.code}
                        </span>
                        <p className="text-[11px] text-white/70 mt-1 font-light">
                          {appliedCoupon.discountText} applied!
                        </p>
                      </div>
                      <button
                        onClick={onRemoveCoupon}
                        className="text-xs font-bold text-rose-400 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Pass Code (e.g. FIRST3)"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        className="flex-1 bg-[#222222] text-[#FDFCF5] text-xs px-3 py-2 rounded-lg border border-white/10 uppercase font-semibold focus:outline-hidden focus:border-[#C5A059]"
                      />
                      <button
                        onClick={handleApplyClick}
                        className="bg-[#C5A059] hover:bg-[#d8b268] text-[#0F0F0F] text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-colors shrink-0"
                      >
                        Apply
                      </button>
                    </div>
                  )}

                  {couponError && (
                    <p className="text-[11px] text-rose-400 font-medium">{couponError}</p>
                  )}
                </div>

                {/* Bill Details Breakdown */}
                <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/10 space-y-2.5 text-xs text-white/70">
                  <h4 className="font-bold text-[#FDFCF5] border-b border-white/10 pb-2 uppercase text-[10px] tracking-[0.2em]">Summary</h4>
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[#FDFCF5]">₹{subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[#C5A059] font-medium">
                      <span>Privilege Savings</span>
                      <span>-₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-white/60">
                    <span>White-Glove Delivery {deliveryFee === 0 && <span className="text-[#C5A059] font-bold">(COMPLIMENTARY)</span>}</span>
                    <span>₹{deliveryFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Taxes & Service</span>
                    <span>₹{taxes.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2.5 flex justify-between font-bold text-[#FDFCF5] text-sm">
                    <span>Total Payable</span>
                    <span className="text-[#C5A059] font-serif font-bold text-base">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Checkout CTA */}
          {cartItems.length > 0 && (
            <div className="p-4 sm:p-6 bg-[#1A1A1A] border-t border-white/10">
              <button
                onClick={() => {
                  onClose();
                  onProceedToCheckout();
                }}
                className="w-full bg-[#C5A059] hover:bg-[#d8b268] text-[#0F0F0F] py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-between group shadow-[0_0_20px_rgba(197,160,89,0.3)]"
              >
                <div className="text-left">
                  <div className="text-[9px] text-[#0F0F0F]/70 uppercase font-bold tracking-widest">Total Payable</div>
                  <div className="text-base font-black font-serif">₹{grandTotal.toFixed(0)}</div>
                </div>
                <div className="flex items-center gap-1.5 font-bold">
                  <span>Proceed to Checkout</span>
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

