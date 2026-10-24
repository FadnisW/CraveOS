'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * SDD §2.3 & §8.4: Wraps view components so a crash in one screen (e.g. a hub/brand outage
 * causing a runtime error) degrades gracefully rather than taking down the whole app shell,
 * navbar, and cart sidebar.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught runtime error in view:', error, info.componentStack);
  }

  render() {
    if (this.props.fallback && this.state.hasError) {
      return this.props.fallback;
    }

    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-8">
          <div className="max-w-sm w-full p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 shadow-lg space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold text-rose-900 dark:text-rose-200">
                Something went wrong
              </h2>
              <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">
                A temporary issue occurred in this section. The rest of the app is still working fine.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/30 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tap to Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
