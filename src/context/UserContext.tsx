'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SavedAddress, UserProfile } from '../types';

interface UserContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isMounted: boolean;
  login: (user: any, token: string) => void;
  logout: () => void;
  refreshUser: (user: any) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/** Bumped whenever the persisted user shape changes. */
const USER_SCHEMA_VERSION = 2;

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

  const membership = raw.membership;
  const membershipExpiry = membership?.renewsAt || membership?.trialEndsAt || null;
  const membershipActive =
    !!membership &&
    ['TRIAL', 'ACTIVE'].includes(membership.status) &&
    (!membershipExpiry || new Date(membershipExpiry).getTime() > Date.now());

  const isMember =
    typeof raw.isMember === 'boolean' ? raw.isMember : membershipActive;

  // Do not label a plan the server did not return. There is no paid plan yet,
  // so inventing "annual" from an ACTIVE status would misrepresent the account.
  const membershipPlan = raw.membershipPlan;

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
    phone: raw.phone || '',
    role: raw.role,
    adminSubRole: raw.adminSubRole,
    scopedHubId: raw.scopedHubId,
    scopedBrandId: raw.scopedBrandId,
    isMember,
    membershipPlan,
    walletBalance,
    referralCode: raw.referralCode || '',
    savedAddresses: addresses,
  };
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always start as null/false to match SSR — localStorage is read only after mount
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Hydrate from localStorage after first client-side mount (fixes Next.js SSR hydration mismatch)
  useEffect(() => {
    const savedToken = localStorage.getItem('eatclub_token');
    const savedUser = localStorage.getItem('eatclub_user');

    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);

        if (parsed.schemaVersion !== USER_SCHEMA_VERSION) {
          // Old sessions may hold raw paise and a fake membership. Force a
          // clean sign-in rather than rendering wrong balances.
          localStorage.removeItem('eatclub_token');
          localStorage.removeItem('eatclub_user');
        } else {
          setUser(parsed.user);
          setToken(savedToken);
        }
      } catch (e) {
        localStorage.removeItem('eatclub_token');
        localStorage.removeItem('eatclub_user');
      }
    }

    setIsMounted(true);
  }, []);

  const persist = (nextUser: UserProfile, accessToken: string) => {
    setUser(nextUser);
    setToken(accessToken);
    localStorage.setItem('eatclub_token', accessToken);
    localStorage.setItem(
      'eatclub_user',
      JSON.stringify({ schemaVersion: USER_SCHEMA_VERSION, user: nextUser }),
    );
  };

  const login = (loggedUser: any, accessToken: string) => {
    persist(normaliseUser(loggedUser), accessToken);
  };

  const refreshUser = (rawUser: any) => {
    const currentToken = token || localStorage.getItem('eatclub_token');
    if (!currentToken) return;
    persist(normaliseUser(rawUser), currentToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('eatclub_token');
    localStorage.removeItem('eatclub_user');
  };

  return (
    <UserContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
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
