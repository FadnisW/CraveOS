'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeProvider, useTheme } from '../../context/ThemeContext';
import { UserProvider, useUser } from '../../context/UserContext';
import { OpsAuthProvider } from './OpsAuthContext';
import { AuthModal } from '../AuthModal';
import { ErrorBoundary } from '../ErrorBoundary';
import {
  canAccessView,
  consoleNavFor,
  defaultViewFor,
  isStaff,
  roleLabel,
} from '../../lib/roles';
import { opsViewForPathname, routeForView } from '../../lib/routes';
import { ChevronRight, LogOut, Moon, ShieldAlert, Store, Sun } from 'lucide-react';

const OpsChrome: React.FC<{
  children: React.ReactNode;
  openAuthModal: () => void;
  isAuthOpen: boolean;
  closeAuthModal: () => void;
  onAuthSuccess: (user: any) => void;
}> = ({
  children,
  openAuthModal,
  isAuthOpen,
  closeAuthModal,
  onAuthSuccess,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, isMounted, logout } = useUser();

  const currentView = opsViewForPathname(pathname);
  const navItems = consoleNavFor(user);
  const staff = isStaff(user);

  // A hub or brand operator who lands on the admin dashboard is sent to the
  // console their role actually owns instead of staring at a denial page.
  useEffect(() => {
    if (!isMounted || !staff) return;
    if (pathname !== '/ops' && pathname !== '/ops/') return;
    if (canAccessView(currentView, user)) return;
    router.replace(routeForView(defaultViewFor(user)));
  }, [currentView, isMounted, pathname, router, staff, user]);

  const signOut = async () => {
    const signedOut = await logout();
    if (signedOut) router.replace('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-40 bg-slate-950 text-slate-200 border-b border-slate-800">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center gap-3">
            <Link href="/ops" className="flex items-center gap-2 shrink-0">
              <span className="w-8 h-8 rounded-xl bg-rose-600 text-white text-sm font-black flex items-center justify-center">
                C
              </span>
              <span className="hidden sm:block text-sm font-black tracking-tight">
                CraveOS <span className="text-rose-400">Ops</span>
              </span>
            </Link>

            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 truncate">
              {isMounted ? roleLabel(user) : 'Checking session…'}
            </span>

            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center"
                aria-label={
                  theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
                }
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              <Link
                href="/"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <Store className="w-3.5 h-3.5" />
                Storefront
              </Link>

              {staff ? (
                <button
                  onClick={() => void signOut()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-rose-400"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              ) : (
                <button
                  onClick={openAuthModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Staff sign in
                </button>
              )}
            </div>
          </div>

          {staff && navItems.length > 0 && (
            <nav className="flex items-center gap-1 overflow-x-auto pb-2 -mx-1 px-1">
              {navItems.map((item) => {
                const active = currentView === item.view;
                return (
                  <Link
                    key={item.view}
                    href={routeForView(item.view)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-colors ${
                      active
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={item.label}
                  >
                    {item.shortLabel}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
      </main>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={closeAuthModal}
        onSuccess={onAuthSuccess}
      />
    </div>
  );
};

const OpsShellInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { login } = useUser();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const openAuthModal = () => setIsAuthOpen(true);
  const closeAuthModal = () => setIsAuthOpen(false);

  const onAuthSuccess = (signedIn: any) => {
    login(signedIn);
    setIsAuthOpen(false);
    if (isStaff(signedIn)) {
      router.replace(routeForView(defaultViewFor(signedIn)));
    }
  };

  return (
    <OpsAuthProvider openAuthModal={openAuthModal}>
      <OpsChrome
        openAuthModal={openAuthModal}
        isAuthOpen={isAuthOpen}
        closeAuthModal={closeAuthModal}
        onAuthSuccess={onAuthSuccess}
      >
        {children}
      </OpsChrome>
    </OpsAuthProvider>
  );
};

/**
 * Operations shell. Providers live in the route-group layout so a console
 * switch is a real client-side navigation that keeps the signed-in session.
 */
export const OpsShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    <UserProvider>
      <OpsShellInner>{children}</OpsShellInner>
    </UserProvider>
  </ThemeProvider>
);
