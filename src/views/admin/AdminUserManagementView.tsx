import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { useUser } from '../../context/UserContext';
import { hasAdminSubRole } from '../../lib/roles';
import { Search, User, Wallet, Shield, AlertCircle, PlusCircle, CheckCircle } from 'lucide-react';

export const AdminUserManagementView: React.FC = () => {
  const { user } = useUser();
  // Operations and marketing admins can read the directory but only support
  // and finance may move money on a customer's wallet.
  const canAdjustWallet = hasAdminSubRole(user, 'SUPPORT_ADMIN', 'FINANCE_ADMIN');

  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Wallet adjustment modal state
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [walletAmount, setWalletAmount] = useState<string>('');
  const [walletReason, setWalletReason] = useState<string>('');
  const [adjusting, setAdjusting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.getUsers(search);
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleAdjustWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !walletAmount || !walletReason) return;

    setAdjusting(true);
    setError(null);
    try {
      const amountPaise = Math.round(parseFloat(walletAmount) * 100);
      await api.admin.adjustWallet(selectedUser.id, amountPaise, walletReason);
      setSuccessMessage(`Successfully adjusted ₹${walletAmount} for ${selectedUser.name}`);
      setSelectedUser(null);
      setWalletAmount('');
      setWalletReason('');
      fetchUsers();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to adjust wallet');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <User className="w-6 h-6 text-rose-500" />
            User Account Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Search registered users, view roles/memberships, and adjust wallet balances
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-rose-500 w-64"
            />
          </div>
          <button
            type="submit"
            className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
          >
            Search
          </button>
        </form>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 font-bold text-gray-900 dark:text-white">
          Registered Users ({users.length})
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 dark:text-slate-500 text-sm">
            Loading user directory...
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-gray-400 dark:text-slate-500 text-sm">
            No users found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Role / Scope</th>
                  <th className="p-4">Membership</th>
                  <th className="p-4">Wallet Balance</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-900 dark:text-white">{u.name}</div>
                      <div className="text-gray-400">{u.email || u.phone}</div>
                    </td>

                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md font-bold text-[11px]">
                        <Shield className="w-3 h-3 text-rose-500" />
                        {u.role || 'CUSTOMER'}
                        {u.adminSubRole && ` (${u.adminSubRole})`}
                      </span>
                      {(u.scopedHubId || u.scopedBrandId) && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          Scope: {u.scopedHubId || u.scopedBrandId}
                        </div>
                      )}
                    </td>

                    <td className="p-4">
                      {u.membership?.status === 'ACTIVE' || u.membership?.status === 'TRIAL' ? (
                        <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">
                          EATCLUB MEMBER ({u.membership.status})
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">Standard User</span>
                      )}
                    </td>

                    <td className="p-4 font-mono font-bold text-gray-900 dark:text-white">
                      ₹{((u.walletBalance || 0) / 100).toFixed(2)}
                    </td>

                    <td className="p-4 text-right">
                      {canAdjustWallet && (
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-emerald-200 dark:border-emerald-800"
                        >
                          Adjust Wallet
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Wallet Adjustment Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-gray-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                Adjust Wallet Balance
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-gray-500 dark:text-slate-400">
              Adjusting wallet balance for <strong className="text-gray-900 dark:text-white">{selectedUser.name}</strong> ({selectedUser.phone || selectedUser.email}).
              Current balance: <strong>₹{((selectedUser.walletBalance || 0) / 100).toFixed(2)}</strong>
            </div>

            <form onSubmit={handleAdjustWallet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Amount in ₹ (Positive to credit, Negative to debit)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 100 or -50"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  required
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Reason for Adjustment (Audit Requirement)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer support compensation for delay"
                  value={walletReason}
                  onChange={(e) => setWalletReason(e.target.value)}
                  required
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {adjusting ? 'Adjusting...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
