'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { MOCK_USER } from '../data/mockData';

interface UserContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isMounted: boolean;
  login: (user: any, token: string) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

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
        setUser({
          ...parsed,
          isMember: parsed.isMember ?? true,
          savedAddresses: parsed.savedAddresses || parsed.addresses || MOCK_USER.savedAddresses,
        });
        setToken(savedToken);
      } catch (e) {
        localStorage.removeItem('eatclub_token');
        localStorage.removeItem('eatclub_user');
      }
    }

    setIsMounted(true);
  }, []);

  const login = (loggedUser: any, accessToken: string) => {
    const formattedUser: UserProfile = {
      id: loggedUser.id || 'usr_' + Date.now(),
      name: loggedUser.name || loggedUser.email?.split('@')[0] || 'Member',
      email: loggedUser.email || '',
      phone: loggedUser.phone || '+919876543210',
      isMember: loggedUser.isMember ?? true,
      membershipPlan: loggedUser.membershipPlan || {
        type: 'annual',
        expiresAt: '2027-12-31',
        totalSavingsToDate: 1250,
      },
      walletBalance: loggedUser.walletBalance ?? 100,
      referralCode: loggedUser.referralCode || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      savedAddresses: loggedUser.savedAddresses || loggedUser.addresses || MOCK_USER.savedAddresses,
    };

    setUser(formattedUser);
    setToken(accessToken);
    localStorage.setItem('eatclub_token', accessToken);
    localStorage.setItem('eatclub_user', JSON.stringify(formattedUser));
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
