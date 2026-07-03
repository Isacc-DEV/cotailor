import { useState } from 'react';
import { api } from '@/lib/api-client';

export interface Session {
  id: string;
  profileId: string;
  state: string;
  createdAt: string;
}

export function useSession() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async (profileId: string): Promise<Session> => {
    setLoading(true);
    setError(null);
    try {
      return await api.sessions.create(profileId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getSession = async (sessionId: string): Promise<Session> => {
    setLoading(true);
    setError(null);
    try {
      return await api.sessions.get(sessionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get session';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitJD = async (sessionId: string, jdText: string) => {
    setLoading(true);
    setError(null);
    try {
      return await api.sessions.submitJD(sessionId, jdText);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit JD';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const answerCards = async (sessionId: string, decisions: any[]) => {
    setLoading(true);
    setError(null);
    try {
      return await api.sessions.answerCards(sessionId, decisions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to answer cards';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createSession,
    getSession,
    submitJD,
    answerCards,
  };
}
