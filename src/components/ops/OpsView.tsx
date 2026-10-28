'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../context/UserContext';
import { useOpsAuth } from './OpsAuthContext';
import { canAccessView, isStaff, roleLabel } from '../../lib/roles';
import { AdminDashboardView } from '../../views/admin/AdminDashboardView';
import { AdminUserManagementView } from '../../views/admin/AdminUserManagementView';
import { AdminOrderManagementView } from '../../views/admin/AdminOrderManagementView';
import { AdminRiderManagementView } from '../../views/admin/AdminRiderManagementView';
import { AdminTicketsView } from '../../views/admin/AdminTicketsView';
import { AdminPlatformView } from '../../views/AdminPlatformView';
import { AdminKDSView } from '../../views/AdminKDSView';
import { AdminDispatchView } from '../../views/AdminDispatchView';
import { HubOpsView } from '../../views/HubOpsView';
import { BrandOpsView } from '../../views/BrandOpsView';
import { RiderConsoleView } from '../../views/RiderConsoleView';
import { KeyRound, ShieldAlert } from 'lucide-react';

/**
 * Mounts exactly one console after checking the same role matrix the old shell
 * used. The API remains the enforcement point; this guard prevents a guessed
 * URL from rendering another team's console at all.
 */
export const OpsView: React.FC<{ view: string }> = ({ view }) => {
  const router = useRouter();
  const { user, isMounted } = useUser();
  const { openAuthModal } = useOpsAuth();

  if (!isMounted) {
    return (
      <div className="py-20 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
        Checking your console access…
      </div>
    );
  }

  if (!isStaff(user) || !canAccessView(view, user)) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-black text-gray-900 dark:text-white">
          This console is not available to your account
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {user
            ? `You are signed in as ${roleLabel(user)}. Ask a super admin if you need access to this console.`
            : 'Sign in with a staff account to open an operations console.'}
        </p>
        {!user && (
          <button
            onClick={openAuthModal}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Sign in
          </button>
        )}
      </div>
    );
  }

  const backToStorefront = () => router.push('/');
  const navigate = (legacyView: string) => {
    const path =
      legacyView === 'admin-kds'
        ? '/ops/kds'
        : legacyView === 'admin-dispatch'
          ? '/ops/dispatch'
          : '/ops';
    router.push(path);
  };

  switch (view) {
    case 'admin-dashboard':
      return <AdminDashboardView />;
    case 'admin-platform':
      return <AdminPlatformView initialTab="staff" />;
    case 'admin-users':
      return <AdminUserManagementView />;
    case 'admin-orders':
      return <AdminOrderManagementView />;
    case 'admin-riders':
      return <AdminRiderManagementView />;
    case 'admin-tickets':
      return <AdminTicketsView />;
    case 'admin-finance':
      return <AdminPlatformView initialTab="finance" />;
    case 'admin-promotions':
      return <AdminPlatformView initialTab="promotions" />;
    case 'admin-audit':
      return <AdminPlatformView initialTab="audit" />;
    case 'admin-kds':
      return <AdminKDSView onBackToStorefront={backToStorefront} />;
    case 'admin-dispatch':
      return <AdminDispatchView onBackToStorefront={backToStorefront} />;
    case 'hub-ops':
      return <HubOpsView onNavigate={navigate} />;
    case 'brand-ops':
      return <BrandOpsView />;
    case 'rider-console':
      return <RiderConsoleView />;
    default:
      return (
        <div className="max-w-lg mx-auto mt-16 p-8 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-center">
          <h1 className="text-lg font-black text-gray-900 dark:text-white">Unknown console</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            This console address does not exist.
          </p>
        </div>
      );
  }
};
