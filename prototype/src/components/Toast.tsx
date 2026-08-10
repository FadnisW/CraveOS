import React from 'react';

interface ToastProps {
  message: string | null;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 md:bottom-8 z-50 flex items-center gap-3 bg-[#1A1A1A] text-[#FDFCF5] px-5 py-3 rounded-full shadow-2xl border border-[#C5A059]/40">
      <span className="material-symbols-outlined text-[#C5A059] text-xl">check_circle</span>
      <span className="text-xs uppercase tracking-wider font-semibold">{message}</span>
      {onClose && (
        <button 
          onClick={onClose}
          className="ml-2 text-white/40 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      )}
    </div>
  );
};

