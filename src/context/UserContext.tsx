'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { MOCK_USER } from '../data/mockData';

interface UserContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: UserProfile, token: string) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return MOCK_USER;
    const token = localStorage.getItem('eatclub_token');
    const savedUser = localStorage.getItem('eatclub_user');
    if (token && savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        return null;
      }
    }
    return token ? MOCK_USER : null;
  });

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('eatclub_token');
  });

  const login = (loggedUser: UserProfile, accessToken: string) => {
    setUser(loggedUser);
    setToken(accessToken);
    if (typeof window !== 'undefined') {
      localStorage.setItem('eatclub_token', accessToken);
      localStorage.setItem('eatclub_user', JSON.stringify(loggedUser));
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eatclub_token');
      localStorage.removeItem('eatclub_user');
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
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
