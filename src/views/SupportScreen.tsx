'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api-client';
import { useUser } from '../context/UserContext';
import { useShop } from '../context/ShopContext';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback';
import type { Order } from '../types';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  KeyRound,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Plus,
  ShieldCheck,
} from 'lucide-react';

interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  authorType: string;
  body: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  orderId?: string | null;
  category: string;
  status: string;
  priority: string;
  resolutionNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  messages?: TicketMessage[];
}

const CATEGORIES = [
  { value: 'MISSING_ITEM', label: 'Missing item' },
  { value: 'WRONG_ITEM', label: 'Wrong item' },
  { value: 'LATE_DELIVERY', label: 'Late delivery' },
  { value: 'PAYMENT_ISSUE', label: 'Payment issue' },
  { value: 'RIDER_SAFETY', label: 'Rider safety' },
  { value: 'OTHER', label: 'Something else' },
];

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  ASSIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  CLOSED: 'bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-slate-300',
};

function categoryLabel(value: string) {
  return CATEGORIES.find((category) => category.value === value)?.label || value.replace(/_/g, ' ');
}

export const SupportScreen: React.FC = () => {
  const { user, isAuthenticated, isMounted } = useUser();
  const { openAuthModal } = useShop();

  const tickets = useApi<Ticket[]>(
    () => api.tickets.getUserTickets(user!.id),
    [user?.id],
    !!user?.id,
  );
  const orders = useApi<Order[]>(
    () => api.getUserOrders(user!.id),
    [user?.id],
    !!user?.id,
  );

  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState('OTHER');
  const [orderId, setOrderId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  const recentOrders = useMemo(() => {
    const rows = Array.isArray(orders.data) ? orders.data : [];
    return rows.slice(0, 10);
  }, [orders.data]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (message.trim().length < 5) {
      setFormError('Describe the problem in at least 5 characters.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const ticket = await api.tickets.create({
        category,
        message: message.trim(),
        orderId: orderId || undefined,
        priority: 'NORMAL',
      });
      setCreatedTicketId(ticket.id);
      setFormOpen(false);
      setMessage('');
      setOrderId('');
      setCategory('OTHER');
      await tickets.reload();
    } catch (err: any) {
      setFormError(err?.message || 'Could not open this ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isMounted) {
    return <LoadingState label="Loading support…" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
          <LifeBuoy className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Sign in for support</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Support tickets are tied to your account and order history, so we can
          look at the right order instead of guessing.
        </p>
        <button
          onClick={openAuthModal}
          className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold"
        >
          Sign in with OTP
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Support</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Open a ticket, reply in the thread, and see the resolution once support closes it.
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setCreatedTicketId(null);
            setFormOpen((open) => !open);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          {formOpen ? 'Close form' : 'New ticket'}
        </button>
      </header>

      {createdTicketId && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            Ticket opened. Support will reply in the thread.
          </div>
          <Link
            href={`/support/${createdTicketId}`}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 underline"
          >
            Open ticket <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={submit}
          className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                What went wrong?
              </span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-rose-500"
              >
                {CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                Related order (optional)
              </span>
              <select
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-rose-500"
              >
                <option value="">No specific order</option>
                {recentOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    #{order.id.slice(0, 8)} — {new Date(order.createdAt).toLocaleDateString('en-IN')}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
              Tell us what happened
            </span>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Include the order number and what you expected."
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:border-rose-500"
            />
          </label>

          {formError && (
            <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Opening ticket…' : 'Open ticket'}
          </button>
        </form>
      )}

      {tickets.loading && <LoadingState label="Loading your tickets…" />}

      {!tickets.loading && tickets.error && (
        <ErrorState
          title="Could not load your tickets"
          message={tickets.error}
          onRetry={() => void tickets.reload()}
        />
      )}

      {!tickets.loading && !tickets.error && (tickets.data?.length || 0) === 0 && !formOpen && (
        <EmptyState
          icon={MessageSquare}
          title="No support tickets"
          description="If something goes wrong with an order, open a ticket and the thread will appear here."
        />
      )}

      <div className="space-y-3">
        {(tickets.data || []).map((ticket) => {
          const messages = ticket.messages || [];
          const lastMessage = messages[messages.length - 1];
          return (
            <Link
              key={ticket.id}
              href={`/support/${ticket.id}`}
              className="block p-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-300 dark:hover:border-rose-900 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">
                      {categoryLabel(ticket.category)}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        STATUS_STYLE[ticket.status] || STATUS_STYLE.OPEN
                      }`}
                    >
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    #{ticket.id.slice(0, 8)} ·{' '}
                    {new Date(ticket.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                  {lastMessage && (
                    <p className="text-xs text-gray-600 dark:text-slate-300 line-clamp-2 mt-2">
                      {lastMessage.body}
                    </p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
              </div>

              {ticket.status === 'RESOLVED' && ticket.resolutionNote && (
                <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-start gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    {ticket.resolutionNote}
                  </p>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 flex items-start gap-3">
        <Clock className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-5">
          Support aims to acknowledge a ticket within 48 hours and resolve it
          within 30 days. The thread keeps every reply, and a resolved ticket is
          read-only so the resolution record cannot be overwritten.
        </p>
      </div>

      {!isAuthenticated && (
        <div className="text-center">
          <KeyRound className="w-5 h-5 mx-auto text-gray-400" />
        </div>
      )}
    </div>
  );
};
