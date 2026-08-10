import React, { useState } from 'react';
import { CartItem, Coupon, Address, TabType } from '../types';

interface CheckoutScreenProps {
  cartItems: CartItem[];
  selectedAddress: Address;
  onOpenAddressModal: () => void;
  appliedCoupon: Coupon | null;
  onApplyCouponCode: (code: string) => boolean;
  onRemoveCoupon: () => void;
  onPlaceOrderSuccess: () => void;
  onBack: () => void;
  setActiveTab: (tab: TabType) => void;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  cartItems,
  selectedAddress,
  onOpenAddressModal,
  appliedCoupon,
  onApplyCouponCode,
  onRemoveCoupon,
  onPlaceOrderSuccess,
  onBack,
  setActiveTab,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'cod'>('upi');
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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

  const handleApplyCoupon = () => {
    setCouponError(null);
    if (!couponInput.trim()) return;
    const success = onApplyCouponCode(couponInput.trim().toUpperCase());
    if (!success) {
      setCouponError('Invalid coupon. Try FIRST3, MEGA150, or EAT60');
    } else {
      setCouponInput('');
    }
  };

  const handlePayAndOrder = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        onPlaceOrderSuccess();
      }, 1800);
    }, 1200);
  };

  if (isSuccess) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl animate-bounce">
          <span className="material-symbols-outlined text-4xl">check_circle</span>
        </div>
        <h2 className="text-2xl font-black text-gray-900">Order Placed Successfully!</h2>
        <p className="text-xs text-gray-500 max-w-sm">
          Your order is confirmed and sent to the kitchen. Redirecting to live tracking...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3.5 py-2 rounded-full shadow-2xs hover:bg-gray-50 transition-colors"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        <span>Back to Shopping</span>
      </button>

      <h1 className="text-2xl font-black text-gray-900">Checkout & Pay</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Delivery & Payment Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Delivery Address Card */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1daaaa] text-xl">location_on</span>
                <h3 className="text-sm font-bold text-gray-900">Delivery Address</h3>
              </div>
              <button
                onClick={onOpenAddressModal}
                className="text-xs font-bold text-[#1daaaa] hover:underline"
              >
                Change
              </button>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-700 space-y-1">
              <div className="font-bold text-gray-900">{selectedAddress.label}</div>
              <div>{selectedAddress.addressLine1}, {selectedAddress.addressLine2}</div>
              <div className="text-gray-500">{selectedAddress.city} - {selectedAddress.zip}</div>
            </div>
          </div>

          {/* Payment Method Options */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1daaaa] text-xl">payments</span>
              <h3 className="text-sm font-bold text-gray-900">Payment Option</h3>
            </div>

            <div className="space-y-3 text-xs">
              <label
                onClick={() => setPaymentMethod('upi')}
                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'upi'
                    ? 'border-[#1daaaa] bg-[#1daaaa]/5'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-emerald-600">account_balance_wallet</span>
                  <div>
                    <div className="font-bold text-gray-900">UPI / Google Pay / PhonePe</div>
                    <div className="text-[11px] text-gray-500">Fast & instant payment</div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'upi'}
                  onChange={() => {}}
                  className="w-4 h-4 text-[#1daaaa]"
                />
              </label>

              <label
                onClick={() => setPaymentMethod('card')}
                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'card'
                    ? 'border-[#1daaaa] bg-[#1daaaa]/5'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-blue-600">credit_card</span>
                  <div>
                    <div className="font-bold text-gray-900">Credit / Debit Card</div>
                    <div className="text-[11px] text-gray-500">Visa, Mastercard, RuPay</div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'card'}
                  onChange={() => {}}
                  className="w-4 h-4 text-[#1daaaa]"
                />
              </label>

              <label
                onClick={() => setPaymentMethod('cod')}
                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'cod'
                    ? 'border-[#1daaaa] bg-[#1daaaa]/5'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-amber-600">local_atm</span>
                  <div>
                    <div className="font-bold text-gray-900">Pay on Delivery</div>
                    <div className="text-[11px] text-gray-500">Cash or UPI upon receiving order</div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'cod'}
                  onChange={() => {}}
                  className="w-4 h-4 text-[#1daaaa]"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Col: Order Summary & Pay Button */}
        <div className="space-y-6">
          {/* Items Summary */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Order Items</h3>
            
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {cartItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{item.quantity}x</span>
                    <span className="text-gray-700 truncate max-w-[120px]">{item.foodItem.name}</span>
                  </div>
                  <span className="font-extrabold text-gray-900">₹{item.totalPrice * item.quantity}</span>
                </div>
              ))}
            </div>

            {/* Coupons Section */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              {appliedCoupon ? (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-800">{appliedCoupon.code} Applied</span>
                  <button onClick={onRemoveCoupon} className="text-rose-600 font-bold hover:underline">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Coupon code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    className="flex-1 bg-gray-50 text-xs px-3 py-2 rounded-xl border border-gray-200 uppercase font-semibold focus:outline-hidden focus:border-[#1daaaa]"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    className="bg-[#1daaaa] text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-[#188e8e]"
                  >
                    Apply
                  </button>
                </div>
              )}
              {couponError && <p className="text-[11px] text-rose-600 font-medium">{couponError}</p>}
            </div>

            {/* Bill Summary */}
            <div className="border-t border-gray-100 pt-3 space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Savings</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes & Charges</span>
                <span>₹{taxes}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between font-extrabold text-gray-900 text-sm">
                <span>Total</span>
                <span className="text-[#1daaaa]">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Pay Action CTA */}
            <button
              disabled={isProcessing}
              onClick={handlePayAndOrder}
              className="w-full bg-[#1daaaa] hover:bg-[#188e8e] text-white py-3.5 px-6 rounded-2xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing Payment...</span>
                </>
              ) : (
                <span>Pay ₹{grandTotal.toFixed(0)} & Place Order</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
