import React, { useState } from 'react';
import { FoodItem, CartItem } from '../types';

interface ItemModalProps {
  item: FoodItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (cartItem: CartItem) => void;
}

export const ItemModal: React.FC<ItemModalProps> = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
}) => {
  if (!isOpen || !item) return null;

  const [selectedPortion, setSelectedPortion] = useState(
    item.portions && item.portions.length > 0 ? item.portions[0] : undefined
  );
  const [selectedAddons, setSelectedAddons] = useState<{ id: string; name: string; price: number }[]>([]);
  const [instructions, setInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);

  const basePrice = selectedPortion ? selectedPortion.price : item.price;
  const addonsPrice = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const unitPrice = basePrice + addonsPrice;
  const totalPrice = unitPrice * quantity;

  const toggleAddon = (addon: { id: string; name: string; price: number }) => {
    setSelectedAddons(prev =>
      prev.some(a => a.id === addon.id)
        ? prev.filter(a => a.id !== addon.id)
        : [...prev, addon]
    );
  };

  const handleAdd = () => {
    onAddToCart({
      foodItem: item,
      quantity,
      selectedPortion,
      selectedAddons,
      instructions,
      totalPrice: unitPrice,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#121212] border border-white/10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-[#FDFCF5] animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* Item Header Banner */}
        <div className="relative h-48 sm:h-56 bg-[#1A1A1A]">
          <img 
            src={item.image} 
            alt={item.name} 
            className="w-full h-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/60 hover:bg-black/90 text-white p-2 rounded-full backdrop-blur-md transition-colors border border-white/10"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
          
          {item.isBestseller && (
            <span className="absolute bottom-4 left-4 bg-[#C5A059] text-[#0F0F0F] font-bold text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow-md">
              ★ BESTSELLER
            </span>
          )}
        </div>

        {/* Item Content Scrollable */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center shrink-0 ${
                item.isVeg ? 'border-emerald-500' : 'border-rose-500'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                }`} />
              </span>
              <h3 className="text-lg font-serif-display font-bold text-[#FDFCF5]">{item.name}</h3>
            </div>
            <p className="text-xs text-white/60 mt-1 leading-relaxed font-light">
              {item.description}
            </p>
          </div>

          {/* Portion Options */}
          {item.portions && item.portions.length > 0 && (
            <div className="space-y-3 border-t border-white/10 pt-4">
              <h4 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-[0.2em]">Select Portion</h4>
              <div className="grid grid-cols-2 gap-3">
                {item.portions.map((portion) => (
                  <button
                    key={portion.name}
                    onClick={() => setSelectedPortion(portion)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedPortion?.name === portion.name
                        ? 'border-[#C5A059] bg-[#C5A059]/15 text-[#C5A059] font-bold'
                        : 'border-white/10 bg-[#1A1A1A] text-white/70 hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-medium">{portion.name}</div>
                    <div className="text-sm font-bold font-serif mt-1">₹{portion.price}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add-ons Options */}
          {item.addons && item.addons.length > 0 && (
            <div className="space-y-3 border-t border-white/10 pt-4">
              <h4 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-[0.2em]">Add Extra Culinary Touches</h4>
              <div className="space-y-2">
                {item.addons.map((addon) => {
                  const isChecked = selectedAddons.some(a => a.id === addon.id);
                  return (
                    <label
                      key={addon.id}
                      onClick={() => toggleAddon(addon)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked 
                          ? 'border-[#C5A059] bg-[#C5A059]/15' 
                          : 'border-white/10 bg-[#1A1A1A] hover:bg-[#222222]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 text-[#C5A059] rounded-sm focus:ring-[#C5A059] accent-[#C5A059]"
                        />
                        <div>
                          <span className="text-xs font-bold text-[#FDFCF5] block">{addon.name}</span>
                          {addon.description && (
                            <span className="text-[11px] text-white/50 font-light">{addon.description}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold font-serif text-[#C5A059]">+₹{addon.price}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="border-t border-white/10 pt-4 space-y-2">
            <h4 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-[0.2em]">Special Preparation Request</h4>
            <textarea
              rows={2}
              placeholder="e.g. Mild spice, extra truffles, delicate seasoning..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-white/10 focus:outline-hidden focus:border-[#C5A059] bg-[#1A1A1A] text-[#FDFCF5] placeholder:text-white/30"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-[#1A1A1A] border-t border-white/10 flex items-center justify-between gap-4">
          {/* Quantity Selector */}
          <div className="flex items-center border border-white/20 rounded-full bg-[#222222] p-1">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center font-bold shadow-xs hover:bg-white/10"
            >
              -
            </button>
            <span className="px-3 font-bold text-sm text-[#FDFCF5]">{quantity}</span>
            <button
              onClick={() => setQuantity(q => q + 1)}
              className="w-8 h-8 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center font-bold shadow-xs hover:bg-white/10"
            >
              +
            </button>
          </div>

          {/* Add Button */}
          <button
            onClick={handleAdd}
            className="flex-1 bg-[#C5A059] hover:bg-[#d8b268] text-[#0F0F0F] py-3 px-6 rounded-full font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-between shadow-md"
          >
            <span>Add to Selection</span>
            <span className="font-serif font-bold text-sm">₹{totalPrice}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

