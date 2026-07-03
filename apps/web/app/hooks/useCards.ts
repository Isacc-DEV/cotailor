import { useState } from 'react';
import { api } from '@/lib/api-client';

export function useCards() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answerCard = async (sessionId: string, cardId: string, answer: any) => {
    setLoading(true);
    setError(null);
    try {
      return await api.sessions.answerCards(sessionId, [{ cardId, answer }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to answer card';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, answerCard };
}
