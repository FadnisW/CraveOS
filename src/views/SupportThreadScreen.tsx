'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api-client';
import { useUser } from '../context/UserContext';
import { useShop } from '../context/ShopContext';
import { ErrorState, LoadingState } from '../components/ui/Feedback';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
  Send,
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

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  ASSIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  CLOSED: 'bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-slate-300',
};

function authorLabel(message: TicketMessage, customerId?: string) {
  if (message.authorType === 'CUSTOMER' || message.authorId === customerId) return 'You';
  if (message.authorType === 'ADMIN') return 'Support';
  return message.authorType.replace(/_/g, ' ').toLowerCase();
}

export const SupportThreadScreen: React.FC<{ ticketId: string }> = ({ ticketId }) => {
  const { user, isAuthenticated, isMounted } = useUser();
  const { openAuthModal } = useShop();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setLoadError(null);
    try {
      const row = await api.tickets.getById(ticketId);
      setTicket(row);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load this ticket.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!isMounted || !isAuthenticated) {
      setLoading(false);
      return;
    }
    void load();
  }, [isMounted, isAuthenticated, load]);

  useEffect(() => {
    if (!isMounted || !isAuthenticated) return;
    const poll = setInterval(() => {
      void load(true);
    }, 20_000);
    return () => clearInterval(poll);
  }, [isMounted, isAuthenticated, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [ticket?.messages?.length]);

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reply.trim().length < 1) return;

    setSending(true);
    setSendError(null);
    try {
      await api.tickets.addMessage(ticketId, reply.trim());
      setReply('');
      await load(true);
    } catch (err: any) {
      setSendError(err?.message || 'Could not send this reply.');
    } finally {
      setSending(false);
    }
  };

  if (!isMounted) {
    return <LoadingState label="Loading this ticket…" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Sign in to view this ticket</h1>
        <button
          onClick={openAuthModal}
          className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold"
        >
          Sign in with OTP
        </button>
      </div>
    );
  }

  if (loading) {
    return <LoadingState label="Loading this ticket…" />;
  }

  if (loadError || !ticket) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <ErrorState
          title="Could not open this ticket"
          message={loadError || 'The ticket was not found.'}
          onRetry={() => void load()}
        />
        <div className="text-center mt-4">
          <Link href="/support" className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
            Back to support
          </Link>
        </div>
      </div>
    );
  }

  const messages = ticket.messages || [];
  const isClosed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-20">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/support"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          All tickets
        </Link>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-xs font-bold"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <header className="p-5 rounded-3xl bg-slate-950 text-white border border-slate-800 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-rose-400">Support ticket</p>
            <h1 className="text-lg font-black">
              {ticket.category.replace(/_/g, ' ')}
            </h1>
            <p className="text-[11px] text-slate-400">
              #{ticket.id.slice(0, 8)} · opened{' '}
              {new Date(ticket.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>
          <span
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
              STATUS_STYLE[ticket.status] || STATUS_STYLE.OPEN
            }`}
          >
            {ticket.status.replace(/_/g, ' ')}
          </span>
        </div>

        {ticket.orderId && (
          <p className="text-[11px] text-slate-300">
            Order <span className="font-mono">#{ticket.orderId.slice(0, 8)}</span>
          </p>
        )}

        {ticket.status === 'RESOLVED' && ticket.resolutionNote && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Resolution</p>
              <p className="text-xs text-emerald-100/90 leading-5">{ticket.resolutionNote}</p>
            </div>
          </div>
        )}
      </header>

      <section className="space-y-3">
        {messages.length === 0 && (
          <div className="p-6 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 text-center text-xs text-gray-500 dark:text-slate-400">
            <MessageSquare className="w-5 h-5 mx-auto mb-2" />
            No messages yet.
          </div>
        )}

        {messages.map((message) => {
          const mine = message.authorType === 'CUSTOMER' || message.authorId === user?.id;
          return (
            <div
              key={message.id}
              className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 space-y-1 ${
                  mine
                    ? 'bg-rose-600 text-white rounded-br-md'
                    : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-slate-100 rounded-bl-md'
                }`}
              >
                <p className={`text-[10px] font-black uppercase tracking-wider ${mine ? 'text-rose-100' : 'text-gray-400'}`}>
                  {authorLabel(message, user?.id)}
                </p>
                <p className="text-xs leading-5 whitespace-pre-line">{message.body}</p>
                <p className={`text-[9px] ${mine ? 'text-rose-200' : 'text-gray-400'}`}>
                  {new Date(message.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </section>

      {isClosed ? (
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-600 dark:text-slate-300 leading-5">
            This ticket is {ticket.status.toLowerCase()} and read-only. Open a new
            ticket if you still need help.
          </p>
        </div>
      ) : (
        <form onSubmit={sendReply} className="space-y-2">
          <label htmlFor="ticket-reply" className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
            Reply to support
          </label>
          <textarea
            id="ticket-reply"
            rows={3}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder="Add anything support should know…"
            className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:border-rose-500"
          />
          {sendError && (
            <p className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[11px] font-bold text-rose-700 dark:text-rose-300">
              {sendError}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-gray-400 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Replies are visible to you and support only.
            </p>
            <button
              type="submit"
              disabled={sending || reply.trim().length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send reply
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
