import React, { useState } from 'react';
import { Address } from '../types';

interface SavedAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  addresses: Address[];
  selectedAddress: Address;
  onSelectAddress: (address: Address) => void;
  onAddAddress: (newAddr: Address) => void;
}

export const SavedAddressModal: React.FC<SavedAddressModalProps> = ({
  isOpen,
  onClose,
  addresses,
  selectedAddress,
  onSelectAddress,
  onAddAddress,
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [label, setLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('San Francisco, CA');
  const [zip, setZip] = useState('94105');

  if (!isOpen) return null;

  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressLine1.trim()) return;

    const newAddr: Address = {
      id: `addr-${Date.now()}`,
      label,
      addressLine1,
      addressLine2,
      city,
      zip,
    };

    onAddAddress(newAddr);
    onSelectAddress(newAddr);
    setIsAddingNew(false);
    setAddressLine1('');
    setAddressLine2('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#121212] border border-white/10 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#FDFCF5]">
        {/* Header */}
        <div className="p-5 bg-[#1A1A1A] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059] text-2xl">location_on</span>
            <h3 className="text-base font-serif-display font-bold text-[#FDFCF5]">Select Delivery Location</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!isAddingNew ? (
            <>
              <div className="space-y-3">
                {addresses.map((addr) => {
                  const isSelected = selectedAddress.id === addr.id;
                  return (
                    <div
                      key={addr.id}
                      onClick={() => {
                        onSelectAddress(addr);
                        onClose();
                      }}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                        isSelected 
                          ? 'border-[#C5A059] bg-[#C5A059]/15' 
                          : 'border-white/10 hover:border-white/20 bg-[#1A1A1A]'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-2xl mt-0.5 ${
                        isSelected ? 'text-[#C5A059]' : 'text-white/40'
                      }`}>
                        {addr.label === 'Home' ? 'home' : addr.label === 'Work' ? 'work' : 'place'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#FDFCF5]">{addr.label}</span>
                          {addr.isDefault && (
                            <span className="bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/60 mt-1 leading-normal font-light">
                          {addr.addressLine1}, {addr.addressLine2 && `${addr.addressLine2}, `}{addr.city} - {addr.zip}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[#C5A059] text-xl">check_circle</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setIsAddingNew(true)}
                className="w-full py-3 px-4 rounded-2xl border border-dashed border-[#C5A059] text-[#C5A059] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#C5A059]/10 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">add_location</span>
                <span>Add New Address</span>
              </button>
            </>
          ) : (
            <form onSubmit={handleSaveNew} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#C5A059] font-bold uppercase tracking-wider text-[10px] mb-1.5">Save Address As</label>
                <div className="flex gap-2">
                  {(['Home', 'Work', 'Other'] as const).map((l) => (
                    <button
                      type="button"
                      key={l}
                      onClick={() => setLabel(l)}
                      className={`flex-1 py-2 rounded-xl font-bold border text-xs uppercase tracking-wider transition-colors ${
                        label === l
                          ? 'bg-[#C5A059] text-[#0F0F0F] border-[#C5A059]'
                          : 'bg-[#1A1A1A] text-white/70 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#C5A059] font-bold uppercase tracking-wider text-[10px] mb-1.5">Address Line 1 *</label>
                <input
                  type="text"
                  required
                  placeholder="House/Flat No, Building Name"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-white/10 bg-[#1A1A1A] text-[#FDFCF5] placeholder:text-white/30 focus:outline-hidden focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-[#C5A059] font-bold uppercase tracking-wider text-[10px] mb-1.5">Street / Area (Line 2)</label>
                <input
                  type="text"
                  placeholder="Street name, landmark"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-white/10 bg-[#1A1A1A] text-[#FDFCF5] placeholder:text-white/30 focus:outline-hidden focus:border-[#C5A059]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#C5A059] font-bold uppercase tracking-wider text-[10px] mb-1.5">City & State</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-white/10 bg-[#1A1A1A] text-[#FDFCF5] focus:outline-hidden focus:border-[#C5A059]"
                  />
                </div>
                <div>
                  <label className="block text-[#C5A059] font-bold uppercase tracking-wider text-[10px] mb-1.5">Zip Code</label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-white/10 bg-[#1A1A1A] text-[#FDFCF5] focus:outline-hidden focus:border-[#C5A059]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 font-bold text-white/70 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#d8b268] font-bold text-[#0F0F0F] uppercase tracking-wider shadow-md"
                >
                  Save Address
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

