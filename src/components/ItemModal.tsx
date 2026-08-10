'use client';

import React, { useState } from 'react';
import { MenuItem, CartItemOption } from '../types';
import { useCart } from '../context/CartContext';
import { X, Plus, Minus, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ItemModalProps {
  item: MenuItem | null;
  onClose: () => void;
}

export const ItemModal: React.FC<ItemModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedOptions, setSelectedOptions] = useState<CartItemOption[]>(() => {
    // Select first options by default for required groups
    const defaults: CartItemOption[] = [];
    item.customizationGroups?.forEach((group) => {
      if (group.required && group.options.length > 0) {
        defaults.push({
          groupId: group.id,
          groupTitle: group.title,
          optionId: group.options[0].id,
          optionName: group.options[0].name,
          price: group.options[0].price,
        });
      }
    });
    return defaults;
  });

  const handleOptionToggle = (
    groupId: string,
    groupTitle: string,
    optionId: string,
    optionName: string,
    price: number,
    required: boolean
  ) => {
    setSelectedOptions((prev) => {
      if (required) {
        // Radio behavior: replace existing option in this group
        const filtered = prev.filter((o) => o.groupId !== groupId);
        return [...filtered, { groupId, groupTitle, optionId, optionName, price }];
      } else {
        // Checkbox behavior: toggle option
        const exists = prev.some((o) => o.groupId === groupId && o.optionId === optionId);
        if (exists) {
          return prev.filter((o) => !(o.groupId === groupId && o.optionId === optionId));
        } else {
          return [...prev, { groupId, groupTitle, optionId, optionName, price }];
        }
      }
    });
  };

  const optionsExtraPrice = selectedOptions.reduce((acc, opt) => acc + opt.price, 0);
  const unitPrice = item.memberPrice + optionsExtraPrice;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    addToCart(item, quantity, selectedOptions);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        >
          {/* Header Image */}
          <div className="relative h-48 sm:h-56 shrink-0 overflow-hidden">
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
            
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                {item.brandId.toUpperCase()}
              </span>
              <h2 className="text-xl font-black">{item.name}</h2>
            </div>
          </div>

          {/* Body Options */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <p className="text-xs text-gray-600 dark:text-slate-300">{item.description}</p>

            {item.customizationGroups?.map((group) => (
              <div key={group.id} className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                  <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                    {group.title}
                  </h3>
                  <span className="text-[10px] font-bold uppercase text-gray-400">
                    {group.required ? 'Required' : 'Optional'}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.options.map((option) => {
                    const isSelected = selectedOptions.some(
                      (o) => o.groupId === group.id && o.optionId === option.id
                    );
                    return (
                      <button
                        key={option.id}
                        onClick={() =>
                          handleOptionToggle(
                            group.id,
                            group.title,
                            option.id,
                            option.name,
                            option.price,
                            group.required
                          )
                        }
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all ${
                          isSelected
                            ? 'border-rose-600 bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                            : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-${group.required ? 'full' : 'md'} border flex items-center justify-center ${
                            isSelected ? 'border-rose-600 bg-rose-600 text-white' : 'border-gray-400'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span>{option.name}</span>
                        </div>

                        {option.price > 0 && (
                          <span className="font-bold text-gray-900 dark:text-white">+₹{option.price}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Price & Add */}
          <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
            {/* Quantity Stepper */}
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm font-extrabold text-gray-900 dark:text-white w-4 text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Add Button */}
            <button
              onClick={handleAddToCart}
              className="flex-1 py-3 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-md shadow-rose-600/30 flex items-center justify-between transition-colors"
            >
              <span>Add to Cart</span>
              <span>₹{totalPrice}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
