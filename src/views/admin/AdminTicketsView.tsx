'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api-client';
import { useUser } from '../../context/UserContext';
import { hasAdminSubRole } from '../../lib/roles';
import {
  AlertCircle,
  CheckCircle2,
  Filter,
  LifeBuoy,
  RefreshCw,
  Send,
  UserCheck,
} from 'lucide-react';

const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const CATEGORIES = [
  'MISSING_ITEM',
  'WRONG_ITEM',
  'LATE_DELIVERY',
  'PAYMENT_ISSUE',
  'RIDER_SAFETY',
  'OTHER',
] as const;
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  ASSIGNED: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  RESOLVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  CLOSED: 'bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
};

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: 'text-rose-600 dark:text-rose-400',
  HIGH: 'text-amber-600 dark:text-amber-400',
  NORMAL: 'text-gray-500 dark:text-slate-400',
  LOW: 'text-gray-400 dark:text-slate-500',
};

export const AdminTicketsView: React.FC = () => {
  const { user } = useUser();
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<any | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');

  const canManage = hasAdminSubRole(user, 'SUPPORT_ADMIN');

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketData, statData] = await Promise.all([
        api.tickets.getAll({
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
        }),
        api.tickets.getStats().catch(() => null),
      ]);
      setTickets(Array.isArray(ticketData) ? ticketData : []);
      setStats(statData || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load support tickets.');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // The list endpoint only filters by status and category. Priority is applied
  // here so the dropdown is honest instead of silently doing nothing.
  const visibleTickets = useMemo(
    () =>
      priorityFilter
        ? tickets.filter((ticket) => ticket.priority === priorityFilter)
        : tickets,
    [tickets, priorityFilter],
  );

  // Only a super admin can list staff; support/ops admins can still assign to
  // themselves, which is the normal first-touch workflow.
  const canListStaff = hasAdminSubRole(user, 'SUPER_ADMIN');
  useEffect(() => {
    if (!canListStaff) return;
    api.admin
      .getStaff()
      .then((rows) => setStaff(Array.isArray(rows) ? rows : []))
      .catch(() => setStaff([]));
  }, [canListStaff]);

  const runAction = async (ticketId: string, action: () => Promise<any>, success: string) => {
    setBusyId(ticketId);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await fetchTickets();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Ticket action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const assignableStaff = useMemo(() => {
    const rows = staff.filter((row) => row.role === 'ADMIN');
    if (user && !rows.some((row) => row.id === user.id)) {
      rows.unshift({ id: user.id, name: `${user.name} (me)`, role: 'ADMIN' });
    }
    return rows;
  }, [staff, user]);

  const statCards = [
    { label: 'Open', value: stats?.open ?? stats?.OPEN ?? 0, tone: 'text-rose-600' },
    { label: 'Assigned', value: stats?.assigned ?? stats?.ASSIGNED ?? 0, tone: 'text-amber-600' },
    { label: 'In Progress', value: stats?.inProgress ?? stats?.IN_PROGRESS ?? 0, tone: 'text-blue-600' },
    { label: 'Resolved', value: stats?.resolved ?? stats?.RESOLVED ?? 0, tone: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-purple-400" />
            Support Ticket Desk
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Customer, hub, brand and rider escalations with a full resolution trail
          </p>
        </div>
        <button
          onClick={fetchTickets}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <Banner tone="error" icon={<AlertCircle className="w-4 h-4" />} text={error} />
      )}
      {message && (
        <Banner tone="success" icon={<CheckCircle2 className="w-4 h-4" />} text={message} />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800"
          >
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              {card.label}
            </div>
            <div className={`text-2xl font-black ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-800 dark:text-slate-200"
          >
            <option value="">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-800 dark:text-slate-200"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-800 dark:text-slate-200"
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          <span className="text-xs font-bold text-gray-400 ml-auto">{visibleTickets.length} tickets</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading tickets…</div>
        ) : visibleTickets.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            No tickets match these filters.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {visibleTickets.map((ticket) => (
              <div key={ticket.id} className="p-5 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-sm text-gray-900 dark:text-white">
                        #{ticket.id.slice(0, 8)}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          STATUS_STYLE[ticket.status] || STATUS_STYLE.OPEN
                        }`}
                      >
                        {ticket.status}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">
                        {String(ticket.category || 'OTHER').replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`text-[10px] font-black ${
                          PRIORITY_STYLE[ticket.priority] || PRIORITY_STYLE.NORMAL
                        }`}
                      >
                        {ticket.priority || 'NORMAL'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      Raised by <strong>{ticket.raisedByType}</strong>
                      {ticket.orderId && (
                        <>
                          {' '}
                          • Order{' '}
                          <span className="font-mono">{String(ticket.orderId).slice(0, 8)}</span>
                        </>
                      )}
                      {' '}
                      • {new Date(ticket.createdAt).toLocaleString('en-IN')}
                    </div>
                    {ticket.description && (
                      <p className="text-xs text-gray-700 dark:text-slate-300 max-w-2xl">
                        {ticket.description}
                      </p>
                    )}
                    {ticket.resolutionNote && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Resolution: {ticket.resolutionNote}
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                      {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                        <>
                          {ticket.status === 'OPEN' && (
                            <button
                              onClick={() =>
                                runAction(
                                  ticket.id,
                                  () => api.tickets.assign(ticket.id, user!.id),
                                  `Ticket #${ticket.id.slice(0, 8)} assigned to you.`,
                                )
                              }
                              disabled={busyId === ticket.id}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Assign to me
                            </button>
                          )}

                          {assignableStaff.length > 1 && ticket.status === 'OPEN' && (
                            <select
                              defaultValue=""
                              onChange={(event) => {
                                const staffId = event.target.value;
                                if (!staffId) return;
                                runAction(
                                  ticket.id,
                                  () => api.tickets.assign(ticket.id, staffId),
                                  `Ticket #${ticket.id.slice(0, 8)} assigned.`,
                                );
                              }}
                              className="px-2 py-1.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-[11px] font-bold"
                            >
                              <option value="">Assign to…</option>
                              {assignableStaff.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name || member.email || member.id.slice(0, 8)}
                                </option>
                              ))}
                            </select>
                          )}

                          {ticket.status === 'ASSIGNED' && (
                            <button
                              onClick={() =>
                                runAction(
                                  ticket.id,
                                  () => api.tickets.updateStatus(ticket.id, 'IN_PROGRESS'),
                                  `Ticket #${ticket.id.slice(0, 8)} is now in progress.`,
                                )
                              }
                              disabled={busyId === ticket.id}
                              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold disabled:opacity-50"
                            >
                              Start work
                            </button>
                          )}

                          {(ticket.status === 'ASSIGNED' || ticket.status === 'IN_PROGRESS') && (
                            <button
                              onClick={() => {
                                setResolveTarget(ticket);
                                setResolutionNote('');
                              }}
                              disabled={busyId === ticket.id}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Resolve
                            </button>
                          )}
                        </>
                      )}

                      {ticket.status === 'RESOLVED' && (
                        <button
                          onClick={() =>
                            runAction(
                              ticket.id,
                              () => api.tickets.updateStatus(ticket.id, 'CLOSED'),
                              `Ticket #${ticket.id.slice(0, 8)} closed.`,
                            )
                          }
                          disabled={busyId === ticket.id}
                          className="px-3 py-1.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-bold disabled:opacity-50"
                        >
                          Close ticket
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {resolveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
              Resolve ticket #{resolveTarget.id.slice(0, 8)}
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              The customer sees this note. Be specific about what was done or refunded.
            </p>
            <textarea
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              rows={4}
              placeholder="e.g. Missing item refunded to wallet — ₹180 credited."
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setResolveTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!resolutionNote.trim()) {
                    setError('A resolution note is required before closing a ticket.');
                    return;
                  }
                  await runAction(
                    resolveTarget.id,
                    () => api.tickets.resolve(resolveTarget.id, resolutionNote.trim()),
                    `Ticket #${resolveTarget.id.slice(0, 8)} resolved.`,
                  );
                  setResolveTarget(null);
                }}
                disabled={busyId === resolveTarget.id}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {busyId === resolveTarget.id ? 'Saving…' : 'Resolve ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Banner: React.FC<{ tone: 'error' | 'success'; icon: React.ReactNode; text: string }> = ({
  tone,
  icon,
  text,
}) => (
  <div
    className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${
      tone === 'error'
        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
        : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
    }`}
  >
    <span className="shrink-0">{icon}</span>
    <span>{text}</span>
  </div>
);
