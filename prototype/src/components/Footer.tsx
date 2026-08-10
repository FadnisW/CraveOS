import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#0A0A0A] border-t border-white/10 mt-20 pt-16 pb-28 md:pb-16 text-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand Info */}
          <div className="space-y-4">
            <span className="text-2xl font-serif-display font-semibold tracking-tight text-[#FDFCF5]">
              Eat<span className="text-[#C5A059] italic font-serif">Club</span>
            </span>
            <p className="text-xs text-white/50 leading-relaxed font-light">
              Order curated gourmet meals with zero markups, artisanal preparation, and 30-minute express white-glove delivery.
            </p>
            <div className="flex gap-3 pt-2">
              <span className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-[#C5A059] hover:text-[#0F0F0F] transition-all cursor-pointer">
                <span className="material-symbols-outlined text-sm">share</span>
              </span>
              <span className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-[#C5A059] hover:text-[#0F0F0F] transition-all cursor-pointer">
                <span className="material-symbols-outlined text-sm">mail</span>
              </span>
            </div>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C5A059] mb-4">Company</h4>
            <ul className="space-y-2.5 text-xs text-white/60">
              <li><a href="#" className="hover:text-[#FDFCF5] transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-[#FDFCF5] transition-colors">Artisan Brands</a></li>
              <li><a href="#" className="hover:text-[#FDFCF5] transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-[#FDFCF5] transition-colors">Journal & Media</a></li>
            </ul>
          </div>

          {/* Help & Legal */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C5A059] mb-4">Help & Legal</h4>
            <ul className="space-y-2.5 text-xs text-white/60">
              <li><a href="#" className="hover:text-[#FDFCF5] transition-colors">Concierge Help</a></li>
              <li><a href="#" className="hover:text-[#FDFCF5] transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-[#FDFCF5] transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-[#FDFCF5] transition-colors">Refund Policy</a></li>
            </ul>
          </div>

          {/* App Download */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C5A059] mb-4">Get the App</h4>
            <p className="text-xs text-white/50 mb-4 font-light">Enjoy exclusive club privileges and real-time live order tracking.</p>
            <div className="space-y-2.5">
              <div className="bg-[#181818] border border-white/10 text-white p-2.5 rounded-lg flex items-center gap-3 cursor-pointer hover:border-[#C5A059]/40 transition-all">
                <span className="material-symbols-outlined text-2xl text-[#C5A059]">phone_iphone</span>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-white/40">Download on the</div>
                  <div className="text-xs font-semibold text-[#FDFCF5]">App Store</div>
                </div>
              </div>
              <div className="bg-[#181818] border border-white/10 text-white p-2.5 rounded-lg flex items-center gap-3 cursor-pointer hover:border-[#C5A059]/40 transition-all">
                <span className="material-symbols-outlined text-2xl text-[#C5A059]">android</span>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-white/40">Get it on</div>
                  <div className="text-xs font-semibold text-[#FDFCF5]">Google Play</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center text-xs text-white/40 gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059]"></span>
            <p className="text-[11px] uppercase tracking-widest">© {new Date().getFullYear()} EatClub Artistry Inc. All rights reserved.</p>
          </div>
          <div className="flex gap-6 text-[10px] uppercase tracking-[0.2em]">
            <span className="hover:text-white/80 cursor-pointer">Privacy</span>
            <span className="hover:text-white/80 cursor-pointer">Terms</span>
            <span className="hover:text-white/80 cursor-pointer">Security</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

