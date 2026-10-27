'use client';

import React from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Inbox,
  action,
}) => (
  <div className="rounded-3xl border border-dashed border-gray-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-10 text-center space-y-3">
    <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 flex items-center justify-center">
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">{title}</h3>
    {description && (
      <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">{description}</p>
    )}
    {action}
  </div>
);

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We could not load this right now. Please try again.',
  onRetry,
}) => (
  <div className="rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-8 text-center space-y-3">
    <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
      <AlertCircle className="w-6 h-6" />
    </div>
    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">{title}</h3>
    <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Try again
      </button>
    )}
  </div>
);

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-gray-500 dark:text-slate-400">
    <Loader2 className="w-4 h-4 animate-spin" />
    {label}
  </div>
);

export const CardSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 animate-pulse">
    <div className="w-full h-36 rounded-xl bg-gray-200 dark:bg-slate-700" />
    <div className="mt-4 h-3 w-2/3 rounded bg-gray-200 dark:bg-slate-700" />
    <div className="mt-2 h-3 w-1/3 rounded bg-gray-200 dark:bg-slate-700" />
  </div>
);
