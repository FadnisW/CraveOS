import React, { useState } from 'react';
import { UserProfile, Address, TabType } from '../types';

interface ProfileScreenProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  addresses: Address[];
  onOpenAddressModal: () => void;
  setActiveTab: (tab: TabType) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  userProfile,
  onUpdateProfile,
  addresses,
  onOpenAddressModal,
  setActiveTab,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(userProfile.name);
  const [email, setEmail] = useState(userProfile.email);
  const [phone, setPhone] = useState(userProfile.phone);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...userProfile,
      name,
      email,
      phone,
    });
    setIsEditing(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 text-[#FDFCF5]">
      {/* Profile Card */}
      <section className="bg-[#181818] rounded-2xl border border-white/10 p-6 shadow-md space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <img 
              src={userProfile.avatar} 
              alt={userProfile.name} 
              className="w-16 h-16 rounded-full object-cover border-2 border-[#C5A059] shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-serif-display font-semibold text-[#FDFCF5]">{userProfile.name}</h1>
                <span className="bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30 text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                  CLUB VIP
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5 font-light">{userProfile.email}</p>
              <p className="text-xs text-white/60 font-light">{userProfile.phone}</p>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs font-bold uppercase tracking-wider text-[#C5A059] hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            <span>{isEditing ? 'Cancel' : 'Edit'}</span>
          </button>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <form onSubmit={handleSave} className="pt-4 border-t border-white/10 space-y-4 text-xs">
            <div>
              <label className="block text-[#C5A059] font-bold uppercase tracking-wider text-[10px] mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-white/10 bg-[#141414] text-[#FDFCF5] focus:outline-hidden focus:border-[#C5A059]"
              />
            </div>
            <div>
              <label className="block text-[#C5A059] font-bold uppercase tracking-wider text-[10px] mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-white/10 bg-[#141414] text-[#FDFCF5] focus:outline-hidden focus:border-[#C5A059]"
              />
            </div>
            <div>
              <label className="block text-[#C5A059] font-bold uppercase tracking-wider text-[10px] mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-white/10 bg-[#141414] text-[#FDFCF5] focus:outline-hidden focus:border-[#C5A059]"
              />
            </div>
            <button
              type="submit"
              className="bg-[#C5A059] hover:bg-[#d8b268] text-[#0F0F0F] px-5 py-2.5 rounded-full font-bold uppercase tracking-wider shadow-md"
            >
              Save Changes
            </button>
          </form>
        )}
      </section>

      {/* Quick Menu Options */}
      <section className="bg-[#181818] rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden shadow-md text-xs font-bold text-[#FDFCF5]">
        <button
          onClick={() => setActiveTab('orders')}
          className="w-full p-4 hover:bg-white/5 flex items-center justify-between transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#C5A059] text-xl">receipt_long</span>
            <span>My Orders & Order History</span>
          </div>
          <span className="material-symbols-outlined text-white/40">chevron_right</span>
        </button>

        <button
          onClick={onOpenAddressModal}
          className="w-full p-4 hover:bg-white/5 flex items-center justify-between transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#C5A059] text-xl">location_on</span>
            <div>
              <span className="block">Saved Addresses ({addresses.length})</span>
              <span className="text-[11px] text-white/40 font-light">
                Default: {addresses[0]?.addressLine1}
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-white/40">chevron_right</span>
        </button>

        <button
          onClick={() => setActiveTab('deals')}
          className="w-full p-4 hover:bg-white/5 flex items-center justify-between transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#C5A059] text-xl">local_offer</span>
            <span>EatClub Offers & Passes</span>
          </div>
          <span className="material-symbols-outlined text-white/40">chevron_right</span>
        </button>

        <div className="w-full p-4 hover:bg-white/5 flex items-center justify-between transition-colors text-left cursor-pointer">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#C5A059] text-xl">credit_card</span>
            <span>Saved Payments & UPI</span>
          </div>
          <span className="text-[11px] text-white/40 font-light">Google Pay / Cards</span>
        </div>

        <div className="w-full p-4 hover:bg-white/5 flex items-center justify-between transition-colors text-left cursor-pointer">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#C5A059] text-xl">help</span>
            <span>Help & Concierge Support</span>
          </div>
          <span className="text-[11px] text-[#C5A059] font-bold uppercase tracking-wider">24/7 Live Concierge</span>
        </div>
      </section>

      {/* Logout button */}
      <button 
        onClick={() => alert('Logged out successfully')}
        className="w-full bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors border border-rose-800/40"
      >
        Sign Out
      </button>
    </div>
  );
};

