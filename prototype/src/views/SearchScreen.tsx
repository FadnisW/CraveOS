import React, { useState } from 'react';
import { FoodItem, Restaurant } from '../types';

interface SearchScreenProps {
  foodItems: FoodItem[];
  restaurants: Restaurant[];
  onSelectItem: (item: FoodItem) => void;
  onSelectRestaurant: (restaurant: Restaurant) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  foodItems,
  restaurants,
  onSelectItem,
  onSelectRestaurant,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = ['Biryani', 'Pizza', 'Fusion Box', 'Salads', 'Healthy Bowls'];

  const filteredItems = foodItems.filter(item => {
    const matchesSearch = searchTerm.trim() === '' || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !selectedCategory || item.category.toLowerCase().includes(selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  const filteredRestaurants = restaurants.filter(r => 
    searchTerm.trim() !== '' && (
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.cuisine.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 text-[#FDFCF5]">
      {/* Search Input Box */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#C5A059] text-xl">
          search
        </span>
        <input
          type="text"
          placeholder="Search for dishes, cuisines, or restaurants (e.g. Biryani, Pizza)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-[#181818] border border-white/10 text-sm focus:outline-hidden focus:border-[#C5A059] text-[#FDFCF5] placeholder:text-white/30 shadow-md font-medium"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>

      {/* Category Quick Chips */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-[0.2em]">Curated Categories</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              selectedCategory === null
                ? 'bg-[#C5A059] text-[#0F0F0F]'
                : 'bg-[#181818] text-white/70 border border-white/10 hover:bg-white/5'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#C5A059] text-[#0F0F0F]'
                  : 'bg-[#181818] text-white/70 border border-white/10 hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Matching Restaurants */}
      {filteredRestaurants.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-serif-display font-bold text-[#FDFCF5]">Matching Brands ({filteredRestaurants.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredRestaurants.map(r => (
              <div
                key={r.id}
                onClick={() => onSelectRestaurant(r)}
                className="bg-[#181818] p-3 rounded-xl border border-white/10 hover:border-[#C5A059] cursor-pointer transition-all flex items-center gap-3 shadow-md"
              >
                <img src={r.image} alt={r.name} className="w-14 h-14 rounded-lg object-cover border border-white/10" />
                <div>
                  <h4 className="text-xs font-bold text-[#FDFCF5]">{r.name}</h4>
                  <p className="text-[11px] text-white/50 font-light">{r.cuisine.join(', ')}</p>
                  <span className="text-[10px] text-[#C5A059] font-bold uppercase tracking-wider">{r.deliveryTime}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matching Dishes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h3 className="text-sm font-serif-display font-bold text-[#FDFCF5]">
            Dishes {filteredItems.length > 0 && `(${filteredItems.length})`}
          </h3>
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-[#181818] rounded-2xl border border-white/10 p-6 space-y-3">
            <span className="material-symbols-outlined text-4xl text-white/20">search_off</span>
            <h4 className="text-sm font-serif-display font-bold text-white/70">No dishes found</h4>
            <p className="text-xs text-white/40 max-w-xs mx-auto font-light">
              Try searching for something else like "Biryani", "Pizza", or "Paneer".
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#181818] p-4 rounded-xl border border-white/10 shadow-md hover:border-[#C5A059]/40 transition-all flex items-start gap-3"
              >
                <img 
                  src={item.image} 
                  alt={item.name} 
                  className="w-20 h-20 rounded-lg object-cover shrink-0 border border-white/10"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-xs border flex items-center justify-center shrink-0 ${
                      item.isVeg ? 'border-emerald-500' : 'border-rose-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                      }`} />
                    </span>
                    <h4 className="text-xs font-bold text-[#FDFCF5] truncate">{item.name}</h4>
                  </div>
                  <p className="text-[11px] text-white/50 line-clamp-2 mt-1 font-light">{item.description}</p>
                  
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs font-serif font-bold text-[#C5A059]">₹{item.price}</span>
                    <button
                      onClick={() => onSelectItem(item)}
                      className="bg-[#C5A059] hover:bg-[#d8b268] text-[#0F0F0F] px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm"
                    >
                      + ADD
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

