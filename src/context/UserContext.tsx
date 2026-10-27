'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SavedAddress, UserProfile } from '../types';
import { api } from '../lib/api-client';

interface UserContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isMounted: boolean;
  login: (user: any) => void;
  logout: () => Promise<boolean>;
  refreshUser: (user: any) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function normaliseAddress(raw: any): SavedAddress {
  const type = String(raw?.type || 'home').toLowerCase();

  return {
    id: raw?.id || '',
    type: type === 'work' ? 'work' : type === 'other' ? 'other' : 'home',
    label: raw?.label || '',
    addressLine: raw?.addressLine || '',
    landmark: raw?.landmark || undefined,
    city: raw?.city || '',
    pincode: raw?.pincode || '',
    lat: Number(raw?.lat),
    lng: Number(raw?.lng),
    resolvedHubId: raw?.resolvedHubId || '',
    isDefault: !!raw?.isDefault,
  };
}

/**
 * The API stores money in paise and memberships as a relation. The storefront
 * renders rupees and a boolean. Normalising here keeps every screen honest —
 * previously a ₹100 balance was displayed as ₹10,000.
 */
function normaliseUser(raw: any): UserProfile {
  if (!raw) {
    throw new Error('Cannot normalise an empty user');
  }

  const rawMembership = raw.membership;
  // A membership is a single row with a single expiry. A plan is only active
  // while it is TRIAL/ACTIVE and that expiry is still in the future.
  const membership =
    rawMembership && rawMembership.endsAt
      ? {
          planId: rawMembership.planId || '',
          planName:
            rawMembership.planName ||
            rawMembership.plan?.name ||
            rawMembership.planId ||
            'Membership',
          planSlug:
            rawMembership.planSlug ?? rawMembership.plan?.slug ?? null,
          status: rawMembership.status,
          startedAt: rawMembership.startedAt || '',
          endsAt: rawMembership.endsAt,
          isActive:
            ['TRIAL', 'ACTIVE'].includes(rawMembership.status) &&
            new Date(rawMembership.endsAt).getTime() > Date.now(),
        }
      : null;

  const isMember = membership?.isActive ?? false;

  const walletBalance =
    typeof raw.walletBalanceRupees === 'number'
      ? raw.walletBalanceRupees
      : Math.round(Number(raw.walletBalance) || 0) / 100;

  // Only usable address rows belong in the book. A row without coordinates or
  // a street line cannot be delivered to and must not appear selectable.
  const addresses = (raw.savedAddresses || raw.addresses || [])
    .map(normaliseAddress)
    .filter(
      (address: SavedAddress) =>
        !!address.id &&
        !!address.addressLine &&
        Number.isFinite(address.lat) &&
        Number.isFinite(address.lng),
    );

  return {
    id: raw.id,
    name: raw.name || '',
    email: raw.email || '',
    phone: raw.phone || undefined,
    role: raw.role,
    adminSubRole: raw.adminSubRole,
    scopedHubId: raw.scopedHubId,
    scopedBrandId: raw.scopedBrandId,
    isMember,
    membership,
    walletBalance,
    referralCode: raw.referralCode || '',
    savedAddresses: addresses,
  };
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always start as null/false to match SSR. The real session is read from the
  // server after mount: there is no token or user snapshot in localStorage.
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const session = await api.getSession();

        if (cancelled) return;

        if (session?.authenticated && session.user) {
          setUser(normaliseUser(session.user));
        } else {
          setUser(null);
        }
      } catch {
        // The API may be starting or briefly unreachable. Stay anonymous and
        // let each screen render its own honest error state; the next load
        // retries hydration.
      } finally {
        if (!cancelled) setIsMounted(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 from any request means the server rejected the session (expired,
  // revoked, or account blocked). Drop the stale profile immediately.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('craveos:session-expired', onExpired);
    return () => window.removeEventListener('craveos:session-expired', onExpired);
  }, []);

  const login = (loggedUser: any) => {
    setUser(normaliseUser(loggedUser));
  };

  const refreshUser = (rawUser: any) => {
    setUser(normaliseUser(rawUser));
  };

  const logout = async () => {
    try {
      // The API revokes the token id before the BFF clears the cookie. If this
      // fails the session is still live, so the UI must not pretend otherwise.
      await api.logout();
      setUser(null);
      return true;
    } catch (error) {
      console.error('Sign out failed; the session is still active.', error);
      return false;
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isMounted,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
