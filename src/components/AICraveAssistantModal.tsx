'use client';

import React, { useState } from 'react';
import { MOCK_MENU_ITEMS } from '../data/mockData';
import { MenuItem } from '../types';
import { useCart } from '../context/CartContext';
import { Bot, Sparkles, X, Plus, Check, Zap, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AICraveAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AICraveAssistantModal: React.FC<AICraveAssistantModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const { addToCart } = useCart();
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [suggestedItems, setSuggestedItems] = useState<MenuItem[]>([]);
  const [aiRationale, setAiRationale] = useState<string>('');
  const [addedAll, setAddedAll] = useState<boolean>(false);

  const samplePrompts = [
    'Party meal for 3 people combining Pizza and Biryani under ₹700',
    'High protein lunch post-workout with 50g+ protein',
    'Late night comfort thali + dessert combo',
  ];

  const handleGenerateRecommendation = (userPrompt: string) => {
    setPrompt(userPrompt);
    setIsGenerating(true);
    setAddedAll(false);

    setTimeout(() => {
      // Intelligently select multi-brand items based on keywords
      const p = userPrompt.toLowerCase();
      let selected: MenuItem[] = [];

      if (p.includes('protein')) {
        selected = MOCK_MENU_ITEMS.filter((i) => i.brandId === 'wefit');
        setAiRationale('Selected macro-counted high protein bowls & juices from WeFit to reach your 50g+ protein target!');
      } else if (p.includes('pizza') || p.includes('party')) {
        const pizza = MOCK_MENU_ITEMS.find((i) => i.brandId === 'mojo-pizza')!;
        const biryani = MOCK_MENU_ITEMS.find((i) => i.brandId === 'zaza-biryani')!;
        selected = [pizza, biryani];
        setAiRationale('Paired MOJO Loaded 2X Topping Pizza with ZAZA Royal Dum Biryani for the ultimate multi-brand party feast!');
      } else {
        const thali = MOCK_MENU_ITEMS.find((i) => i.brandId === 'box8')!;
        const dessert = MOCK_MENU_ITEMS.find((i) => i.brandId === 'mojo-pizza')!;
        selected = [thali, dessert];
        setAiRationale('Combined BOX8 Royal Thali Meal with Garlic Breadstix for a balanced gourmet combo!');
      }

      setSuggestedItems(selected);
      setIsGenerating(false);
    }, 1000);
  };

  const handleAddAllToCart = () => {
    suggestedItems.forEach((item) => addToCart(item));
    setAddedAll(true);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 text-white shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                  AI Crave Assistant
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                    Gemini AI
                  </span>
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">What are you in the mood for today?</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Try Sample Prompts:</span>
            <div className="flex flex-wrap gap-2">
              {samplePrompts.map((sp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleGenerateRecommendation(sp)}
                  className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-xs font-semibold text-gray-800 dark:text-slate-200 text-left transition-colors"
                >
                  ✨ {sp}
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Describe your craving or budget..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateRecommendation(prompt)}
                className="w-full pl-4 pr-12 py-3 rounded-2xl bg-gray-100 dark:bg-slate-800 text-xs text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 focus:border-rose-500 focus:outline-none"
              />
              <button
                onClick={() => handleGenerateRecommendation(prompt)}
                disabled={isGenerating || !prompt.trim()}
                className="absolute right-2 top-2 p-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Generated Result */}
          {isGenerating && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 flex items-center gap-2 animate-pulse">
                <Sparkles className="w-4 h-4 text-rose-500 animate-spin shrink-0" />
                <div className="h-3.5 bg-rose-200 dark:bg-rose-900/60 rounded-lg w-3/4" />
              </div>

              {/* Skeleton Loaders mimicking meal combo cards */}
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/60 dark:border-slate-700/50 animate-pulse">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-700 shrink-0" />
                      <div className="space-y-1.5 w-full pr-4">
                        <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-md w-2/3" />
                        <div className="h-2 bg-rose-100 dark:bg-rose-950/60 rounded-md w-1/4" />
                      </div>
                    </div>
                    <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded-md w-10 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isGenerating && suggestedItems.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p>{aiRationale}</p>
              </div>

              <div className="space-y-2">
                {suggestedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700 text-xs">
                    <div className="flex items-center gap-3">
                      <img src={item.image} alt={item.name} className="w-10 h-10 rounded-xl object-cover" />
                      <div>
                        <h4 className="font-extrabold text-gray-900 dark:text-white">{item.name}</h4>
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase">{item.brandId}</span>
                      </div>
                    </div>
                    <span className="font-black text-gray-900 dark:text-white">₹{item.memberPrice}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddAllToCart}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all"
              >
                {addedAll ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{addedAll ? 'Added Combo to Cart!' : 'Add Combo to Cart'}</span>
              </button>
            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
