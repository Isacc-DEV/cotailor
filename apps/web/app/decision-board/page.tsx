'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Button, Spinner, Badge } from '@/app/components/ui';
import { LoadingScreen } from '@/app/components/screens/LoadingScreen';
import { api } from '@/lib/api-client';
import './page.css';

interface CardOption {
  option_id: string;
  label: string;
  consequence?: string;
}
interface CardPayload {
  title?: string;
  message?: string;
  options?: CardOption[];
  recommended_option?: string | null;
}
interface Card {
  id: string;
  cardType: string;
  severity: string;
  status: string;
  payload: CardPayload;
}
interface Session {
  id: string;
  state: string;
  cards: Card[];
  // Set by the backend when the background analysis job died (e.g. LLM 429).
  analysisError?: string;
}

const SEVERITY_VARIANT: Record<string, 'default' | 'warning' | 'error' | 'success'> = {
  info: 'default',
  warning: 'warning',
  blocking: 'error',
  critical: 'error',
};

export default function DecisionBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return null;
    const data: Session = await api.sessions.get(sessionId);
    setSession(data);
    return data;
  }, [sessionId]);

  // Initial load + poll while analysis is still running.
  useEffect(() => {
    if (!sessionId) {
      router.push('/jd-input');
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // ~90s safety net; real failures surface via analysisError
    const INTERVAL_MS = 1500;

    const tick = async () => {
      try {
        const data = await fetchSession();
        if (cancelled || !data) return;
        // The backend recorded a failure from the LLM provider — stop polling and show it.
        if (data.analysisError) {
          setError(data.analysisError);
          return;
        }
        if (data.state === 'ANALYZING' || data.state === 'JD_SUBMITTED') {
          attempts += 1;
          if (attempts >= MAX_ATTEMPTS) {
            setError('Analysis is taking much longer than expected. Please try submitting the job description again.');
            return;
          }
          timer = setTimeout(tick, INTERVAL_MS);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error loading session');
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId, fetchSession, router]);

  // Once the board is complete, the backend moves to STRATEGY_REVIEW.
  useEffect(() => {
    if (session?.state === 'STRATEGY_REVIEW') {
      router.push(`/strategy-review?sessionId=${sessionId}`);
    }
  }, [session?.state, sessionId, router]);

  const answer = async (cardId: string, optionId: string) => {
    if (!sessionId) return;
    setAnswering(cardId);
    setError(null);
    try {
      await api.sessions.answerCard(sessionId, cardId, optionId);
      await fetchSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to answer');
    } finally {
      setAnswering(null);
    }
  };

  const analysisFailedScreen = (message: string) => (
    <div className="decision-board">
      <div className="all-answered">
        <div className="success-icon error-icon">!</div>
        <h2>Analysis failed</h2>
        <p>Something went wrong while analyzing the job description:</p>
        <div className="error-detail">{message}</div>
        <p className="error-hint">
          If this mentions a rate limit or quota (e.g. 429), wait a moment or check the LLM provider&apos;s API key, then try again.
        </p>
        <div className="board-error-actions">
          <Button variant="primary" onClick={() => router.push(`/jd-input?sessionId=${sessionId}`)}>
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );

  if (!sessionId) return null;

  if (!session) {
    return (
      <div className="decision-board">
        <div className="board-loading">
          {error ? (
            <div className="all-answered">
              <div className="success-icon error-icon">!</div>
              <h2>Couldn&apos;t load this session</h2>
              <div className="error-detail">{error}</div>
              <div className="board-error-actions">
                <Button variant="primary" onClick={() => router.push('/jd-input')}>
                  Start a New Session
                </Button>
              </div>
            </div>
          ) : (
            <Spinner text="Loading decisions..." />
          )}
        </div>
      </div>
    );
  }

  const { state, cards } = session;

  if (state === 'ANALYZING' || state === 'JD_SUBMITTED') {
    if (error) return analysisFailedScreen(error);
    return <LoadingScreen phase="analyzing" />;
  }

  if (state === 'CATEGORY_REJECTED') {
    const card = cards.find((c) => c.cardType === 'category_mismatch');
    return (
      <div className="decision-board">
        <div className="all-answered">
          <div className="success-icon error-icon">✕</div>
          <h2>{card?.payload.title || "This job doesn't match your profile"}</h2>
          <p>{card?.payload.message}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            <Button variant="secondary" onClick={() => router.push('/profile-selector')}>
              Select Another Profile
            </Button>
            <Button variant="primary" onClick={() => router.push(`/jd-input?sessionId=${sessionId}`)}>
              Use Another JD
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'CANCELLED') {
    return (
      <div className="decision-board">
        <div className="all-answered">
          <h2>Session cancelled</h2>
          <Button variant="primary" onClick={() => router.push('/profile-selector')}>
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  const pending = cards.filter((c) => c.status === 'pending');
  const answered = cards.filter((c) => c.status === 'answered');

  return (
    <div className="decision-board">
      <div className="board-header">
        <h1>Decision Board</h1>
        <p>Answer the questions below to tailor your resume — nothing goes on your resume until you choose.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {pending.length > 0 ? (
        <div className="board-content">
          <h2>Your Decisions</h2>
          <p className="cards-subtitle">
            {pending.length} decision{pending.length !== 1 ? 's' : ''} remaining
          </p>

          {pending.map((card) => (
            <div key={card.id} className="decision-card">
              <div className="decision-card-head">
                <Badge variant={SEVERITY_VARIANT[card.severity] || 'default'}>{card.severity}</Badge>
                <h3>{card.payload.title}</h3>
              </div>
              {card.payload.message && <p className="decision-card-msg">{card.payload.message}</p>}
              <div className="decision-options">
                {(card.payload.options || []).map((opt) => (
                  <button
                    key={opt.option_id}
                    className={`decision-option ${
                      card.payload.recommended_option === opt.option_id ? 'recommended' : ''
                    }`}
                    disabled={answering === card.id}
                    onClick={() => answer(card.id, opt.option_id)}
                  >
                    <span className="opt-label">
                      {opt.label}
                      {card.payload.recommended_option === opt.option_id && (
                        <span className="opt-recommended"> · recommended</span>
                      )}
                    </span>
                    {opt.consequence && <span className="opt-consequence">{opt.consequence}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="all-answered">
          <div className="success-icon">✓</div>
          <h2>All decisions answered</h2>
          <p>Preparing your strategy…</p>
          <Button variant="primary" onClick={() => router.push(`/strategy-review?sessionId=${sessionId}`)}>
            Continue
          </Button>
        </div>
      )}

      {answered.length > 0 && (
        <div className="assumed-defaults">
          <h2>Answered</h2>
          <div className="defaults-list">
            {answered.map((card) => (
              <div key={card.id} className="default-item">
                <Badge variant="success">✓</Badge>
                <p className="default-question">{card.payload.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
