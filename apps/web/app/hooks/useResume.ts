import { useState } from 'react';
import { api } from '@/lib/api-client';

export function useResume() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getResume = async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      return await api.sessions.getResume(sessionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get resume';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const exportResume = async (sessionId: string, format: 'docx' | 'pdf' | 'json') => {
    setLoading(true);
    setError(null);
    try {
      return await api.sessions.exportResume(sessionId, format);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export resume';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, getResume, exportResume };
}
