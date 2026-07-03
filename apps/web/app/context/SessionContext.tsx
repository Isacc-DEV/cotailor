'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export interface Session {
  id: string;
  profileId: string;
  profileName: string;
  state: 'created' | 'analyzing' | 'waiting_decisions' | 'strategy_review' | 'generating' | 'validating' | 'completed' | 'rejected' | 'cancelled';
  jdText?: string;
  analysisResults?: any;
  pendingCards?: any[];
  decisions?: any[];
  strategy?: any;
  resume?: any;
  createdAt: string;
  updatedAt: string;
}

interface SessionContextType {
  currentSession: Session | null;
  setCurrentSession: (session: Session | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSession = () => {
    setCurrentSession(null);
    setError(null);
  };

  return (
    <SessionContext.Provider
      value={{
        currentSession,
        setCurrentSession,
        isLoading,
        setIsLoading,
        error,
        setError,
        clearSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within SessionProvider');
  }
  return context;
}
