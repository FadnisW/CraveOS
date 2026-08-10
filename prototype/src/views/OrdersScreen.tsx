import React from 'react';
import { Order, TabType } from '../types';

interface OrdersScreenProps {
  orders: Order[];
  onReorder: (order: Order) => void;
  setActiveTab: (tab: TabType) => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  orders,
  onReorder,
  setActiveTab,
}) => {
  const activeOrder = orders.find(o => o.active);
  const pastOrders = orders.filter(o => !o.active);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 text-[#FDFCF5]">
      {/* Active Order Live Tracker */}
      {activeOrder && (
        <section className="bg-[#181818] rounded-2xl border border-white/10 overflow-hidden shadow-xl space-y-4">
          <div className="p-5 bg-[#141414] border-b border-white/10 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C5A059] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#C5A059]"></span>
              </span>
              <div>
                <h2 className="font-serif-display font-bold text-base text-[#FDFCF5]">Active Order #{activeOrder.id}</h2>
                <p className="text-xs text-white/60 font-light">{activeOrder.restaurantName}</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-[#C5A059] uppercase tracking-[0.2em] block">ESTIMATED ARRIVAL</span>
              <span className="text-xl font-serif font-bold text-[#FDFCF5]">{activeOrder.etaMinutes || 15} Mins</span>
            </div>
          </div>

          {/* Map Preview Image */}
          <div className="relative h-48 bg-[#101010] overflow-hidden">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD0DwIyNTmztTEuAR3x62vUnkzBeYlYIay7S1qpLU9Rxnxvf4BHqpTEKoJy0E6HI0wYC4a0vsLeGmMRuXxui5BjEMIwlD-PF_xHkWQdjTR1OI6UOu4Ua7ugXuTT_cPXELlYWYZinkKEgBkT3-OkxSytgE8oytA5ws8a4RqSp3cvduLFuihTmzks0P1PHaV_I3PV0Jod01q51jWVJSiQ7kGijA45axyQPvjQeBdueOqTgfqnUwmuqcWZug" 
              alt="Live Delivery Map Route" 
              className="w-full h-full object-cover filter brightness-75"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent pointer-events-none" />
            
            {/* Live Driver Card Badge */}
            <div className="absolute bottom-3 left-3 right-3 bg-[#121212]/90 backdrop-blur-md p-3.5 rounded-xl shadow-lg border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD0h-MSVWtHcrh7pZbTXGm_Az_CuZ52DvdNo_2Lh6xnSTw4TDRd6QHjNTmj3C-4zuh38TPvFkSkYKqXbGMQL_C5u1LwvcnS00UHCzEC7fWVW8sm_W3c7GLL0qh6g3l8-KLv322wh7QICkmgezRQhpIVEZhNBj6C2PAfLNi4pMU1MDdnKMIXtggg6XZJtcisv_xnCcMuSeSp7l9IewiXeBux_DpoA3Iu7-aaR12PwbkOp0p-cn-hmLC_Bg" 
                  alt={activeOrder.driverName || 'Driver'} 
                  className="w-10 h-10 rounded-full object-cover border border-[#C5A059]"
                />
                <div>
                  <div className="text-xs font-bold text-[#FDFCF5]">{activeOrder.driverName || 'Alex Mercer'}</div>
                  <div className="text-[11px] text-[#C5A059] font-medium">{activeOrder.driverRating || '4.9 ★ Culinary Courier'}</div>
                </div>
              </div>

              <a
                href={`tel:${activeOrder.driverPhone || '555-987-6543'}`}
                className="bg-[#C5A059] hover:bg-[#d8b268] text-[#0F0F0F] p-2.5 rounded-full text-xs font-bold transition-colors flex items-center justify-center shadow-md"
                title="Call Driver"
              >
                <span className="material-symbols-outlined text-lg">call</span>
              </a>
            </div>
          </div>

          {/* Stepper Progress */}
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold uppercase tracking-wider">
              <div className="text-[#C5A059]">1. Confirmed</div>
              <div className="text-[#C5A059]">2. Preparing</div>
              <div className="text-[#C5A059] underline">3. In Transit</div>
              <div className="text-white/30">4. Delivered</div>
            </div>

            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div className="bg-[#C5A059] h-full w-3/4 rounded-full transition-all duration-500" />
            </div>

            <div className="pt-2 text-xs text-white/60 flex justify-between border-t border-white/10 font-light">
              <span>Items: {activeOrder.itemsSummary}</span>
              <span className="font-serif font-bold text-[#C5A059]">₹{activeOrder.totalPrice.toFixed(2)}</span>
            </div>
          </div>
        </section>
      )}

      {/* Past Orders History */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div>
            <h2 className="text-lg font-serif-display font-semibold text-[#FDFCF5]">Order History</h2>
            <p className="text-xs text-white/50 font-light">View and reorder past culinary experiences</p>
          </div>
        </div>

        {pastOrders.length === 0 ? (
          <div className="bg-[#181818] rounded-2xl p-8 text-center border border-white/10 text-white/40 text-xs font-light">
            No past orders found.
          </div>
        ) : (
          <div className="space-y-4">
            {pastOrders.map((order) => (
              <div
                key={order.id}
                className="bg-[#181818] rounded-xl border border-white/10 p-4 sm:p-5 shadow-md hover:border-[#C5A059]/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {order.restaurantImage ? (
                    <img 
                      src={order.restaurantImage} 
                      alt={order.restaurantName} 
                      className="w-14 h-14 rounded-lg object-cover shrink-0 border border-white/10"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#C5A059] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl">restaurant</span>
                    </div>
                  )}

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-[#FDFCF5] truncate">{order.restaurantName}</h3>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        order.status === 'Delivered'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {order.status}
                      </span>
                    </div>

                    <p className="text-xs text-white/60 line-clamp-1 font-light">{order.itemsSummary}</p>
                    <div className="text-[11px] text-white/40 font-mono">
                      {order.date} • {order.itemCount} items • <span className="text-[#C5A059] font-serif">₹{order.totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full sm:w-auto flex items-center justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10">
                  <button
                    onClick={() => onReorder(order)}
                    className="w-full sm:w-auto bg-[#C5A059] hover:bg-[#d8b268] text-[#0F0F0F] px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">replay</span>
                    <span>Reorder</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

