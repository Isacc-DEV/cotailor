import { useState } from 'react';
import { api } from '@/lib/api-client';

export function useStrategy() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStrategy = async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      return await api.sessions.getStrategy(sessionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get strategy';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const approveStrategy = async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      return await api.sessions.approveStrategy(sessionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve strategy';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, getStrategy, approveStrategy };
}
