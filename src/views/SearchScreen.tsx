'use client';

import React, { useState } from 'react';
import { MOCK_MENU_ITEMS, MOCK_BRANDS } from '../data/mockData';
import { MenuItem, BrandId } from '../types';
import { useCart } from '../context/CartContext';
import { Search, Star, Plus, Check, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface SearchScreenProps {
  onBack: () => void;
  onOpenItemModal: (item: MenuItem) => void;
  onSelectBrand: (brandId: BrandId) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onBack,
  onOpenItemModal,
  onSelectBrand,
}) => {
  const [query, setQuery] = useState<string>('');
  const { addToCart, cartItems } = useCart();

  const searchResults = query.trim()
    ? MOCK_MENU_ITEMS.filter(
        (item) =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase()) ||
          item.brandId.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 text-xs font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      <div className="relative">
        <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
        <input
          type="text"
          placeholder="Search for Pizza, Biryani, Thalis, Rolls, Bowls..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 shadow-sm focus:border-rose-500 focus:outline-none"
        />
      </div>

      {query.trim() && (
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">
            Search Results ({searchResults.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchResults.map((item) => {
              const isAdded = cartItems.some((ci) => ci.item.id === item.id);
              return (
                <div
                  key={item.id}
                  className="flex gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm"
                >
                  <img src={item.image} alt={item.name} className="w-24 h-24 rounded-xl object-cover" />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-rose-500 uppercase">{item.brandId}</span>
                      <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">{item.name}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="font-extrabold text-sm text-gray-900 dark:text-white">₹{item.memberPrice}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="px-3 py-1 rounded-xl bg-rose-600 text-white text-xs font-bold"
                      >
                        {isAdded ? 'Added' : 'ADD +'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
