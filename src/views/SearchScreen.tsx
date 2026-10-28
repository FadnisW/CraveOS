'use client';

import React, { useEffect, useState } from 'react';
import { MenuItem, BrandId } from '../types';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { api } from '../lib/api-client';
import { mapApiMenuItems } from '../lib/catalog-mapper';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback';
import { Search, Plus, Check, ArrowLeft, MapPin, UtensilsCrossed, SearchX } from 'lucide-react';

interface SearchScreenProps {
  hubId?: string;
  onBack: () => void;
  onOpenItemModal: (item: MenuItem) => void;
  onSelectBrand: (brandId: BrandId) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  hubId,
  onBack,
  onOpenItemModal,
  onSelectBrand,
}) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const { addToCart, cartItems } = useCart();
  const { user } = useUser();

  useEffect(() => {
    const term = query.trim();

    if (!term) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const rows = await api.searchItems(term, hubId);
        if (cancelled) return;
        setResults(mapApiMenuItems(rows));
        setHasSearched(true);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Search is unavailable right now.');
        setResults([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, hubId]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 text-xs font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      {!hubId && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-5">
            <span className="font-extrabold">Set your delivery address.</span> You
            are searching the full live menu. With an address, results are limited
            to what your hub can actually cook.
          </p>
        </div>
      )}

      <div className="relative">
        <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
        <input
          type="text"
          placeholder="Search the live menu..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
          className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 shadow-sm focus:border-rose-500 focus:outline-none"
        />
      </div>

      {!query.trim() && (
        <EmptyState
          icon={Search}
          title="Search the menu"
          description="Results come from the live catalogue for the hubs that are currently open."
        />
      )}

      {query.trim() && isLoading && <LoadingState label="Searching the live menu…" />}

      {query.trim() && !isLoading && error && (
        <ErrorState title="Search failed" message={error} />
      )}

      {query.trim() && !isLoading && !error && hasSearched && results.length === 0 && (
        <EmptyState
          icon={SearchX}
          title={`No matches for “${query.trim()}”`}
          description="Try a dish, a cuisine, or a brand name."
        />
      )}

      {query.trim() && !isLoading && !error && results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">
            {results.length} result{results.length === 1 ? '' : 's'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((item) => {
              const inCart = cartItems.some((cartItem) => cartItem.item.id === item.id);
              const needsOptions = (item.customizationGroups?.length || 0) > 0;
              const showMemberPrice = user?.isMember === true;

              return (
                <div
                  key={item.id}
                  className="flex gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm"
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-24 h-24 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-400 flex items-center justify-center">
                      <UtensilsCrossed className="w-7 h-7" />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <button
                        onClick={() => item.brandId && onSelectBrand(item.brandId)}
                        className="text-[10px] font-bold text-rose-500 uppercase hover:underline"
                      >
                        {item.brandName || item.brandId.replace(/-/g, ' ')}
                      </button>
                      <h3 className="font-extrabold text-sm text-gray-900 dark:text-white truncate">
                        {item.name}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="font-extrabold text-sm text-gray-900 dark:text-white">
                          ₹{showMemberPrice ? item.memberPrice : item.mrp}
                        </span>
                        {showMemberPrice && item.memberPrice < item.mrp && (
                          <span className="text-[10px] text-gray-400 line-through">₹{item.mrp}</span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (needsOptions) onOpenItemModal(item);
                          else addToCart(item);
                        }}
                        disabled={!item.isAvailable}
                        className="px-3 py-1 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-40"
                      >
                        {inCart ? (
                          <span className="inline-flex items-center gap-1">
                            <Check className="w-3 h-3" /> Added
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Add
                          </span>
                        )}
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
