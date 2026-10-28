'use client';

import React, { createContext, useContext } from 'react';

interface OpsAuthContextValue {
  openAuthModal: () => void;
}

const OpsAuthContext = createContext<OpsAuthContextValue | undefined>(undefined);

export const OpsAuthProvider: React.FC<{
  openAuthModal: () => void;
  children: React.ReactNode;
}> = ({ openAuthModal, children }) => (
  <OpsAuthContext.Provider value={{ openAuthModal }}>
    {children}
  </OpsAuthContext.Provider>
);

export const useOpsAuth = () => {
  const context = useContext(OpsAuthContext);
  if (!context) {
    throw new Error('useOpsAuth must be used within an OpsAuthProvider');
  }
  return context;
};
