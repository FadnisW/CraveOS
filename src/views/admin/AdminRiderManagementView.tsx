import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { Bike, Shield, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

export const AdminRiderManagementView: React.FC = () => {
  const [approvalQueue, setApprovalQueue] = useState<any[]>([]);
  const [allRiders, setAllRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Status Modal
  const [selectedRider, setSelectedRider] = useState<any | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>('APPROVED');
  const [reason, setReason] = useState<string>('');
  const [updating, setUpdating] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchRiderData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [queueData, ridersData] = await Promise.all([
        api.riders.getApprovalQueue().catch(() => []),
        api.riders.getAll().catch(() => []),
      ]);
      setApprovalQueue(queueData);
      setAllRiders(ridersData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch riders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiderData();
  }, []);

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRider) return;

    setUpdating(true);
    try {
      await api.riders.updateStatus(selectedRider.id, targetStatus, reason);
      setSuccessMsg(`Rider ${selectedRider.name} status updated to ${targetStatus}`);
      setSelectedRider(null);
      setReason('');
      fetchRiderData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update rider status');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Bike className="w-6 h-6 text-emerald-500" />
            Delivery Partner Operations & KYC Approval
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review pending KYC submissions, manage rider statuses (Approve / Reject / Suspend), and monitor online fleet
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KYC Approval Queue Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Pending KYC Approval Queue ({approvalQueue.length})
          </h2>
        </div>

        {approvalQueue.length === 0 ? (
          <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-sm">
            No pending KYC submissions in queue.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {approvalQueue.map((r) => (
              <div key={r.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-sm text-gray-900 dark:text-white">{r.name}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Phone: {r.phone} • Vehicle: {r.vehicleType || 'BIKE'}</div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1">Status: PENDING_APPROVAL</div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedRider(r);
                      setTargetStatus('APPROVED');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Approve KYC
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRider(r);
                      setTargetStatus('REJECTED');
                    }}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Delivery Partners List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 font-bold text-gray-900 dark:text-white">
          All Delivery Partners ({allRiders.length})
        </div>

        {allRiders.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No riders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-500 dark:text-slate-400 font-bold uppercase">
                <tr>
                  <th className="p-4">Rider</th>
                  <th className="p-4">KYC Status</th>
                  <th className="p-4">Online Fleet Status</th>
                  <th className="p-4">Staged Hub</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {allRiders.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-900 dark:text-white">{r.name}</div>
                      <div className="text-gray-400">{r.phone}</div>
                    </td>

                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] ${
                        r.status === 'APPROVED' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' :
                        r.status === 'PENDING_APPROVAL' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' :
                        'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      }`}>
                        {r.status}
                      </span>
                    </td>

                    <td className="p-4">
                      {r.isOnline ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          🟢 Online Staged
                        </span>
                      ) : (
                        <span className="text-gray-400 font-medium">⚪ Offline</span>
                      )}
                    </td>

                    <td className="p-4 font-mono text-gray-700 dark:text-slate-300">
                      {r.currentHub?.name || r.currentHubId || 'Unstaged'}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedRider(r);
                          setTargetStatus(r.status === 'APPROVED' ? 'SUSPENDED' : 'APPROVED');
                        }}
                        className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      >
                        Change Status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Update Rider Status Modal */}
      {selectedRider && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-gray-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-500" />
                Update Rider Status: {selectedRider.name}
              </h3>
              <button
                onClick={() => setSelectedRider(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStatusUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Target Status
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white font-bold"
                >
                  <option value="APPROVED">APPROVED</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Reason / Internal Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. KYC documents verified / Document expired"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRider(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Save Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
