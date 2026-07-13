'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  // Structured extras from the backend — used to bold the key term in the title.
  context?: Record<string, unknown>;
}
interface Card {
  id: string;
  cardType: string;
  severity: string;
  status: string;
  payload: CardPayload;
  // The option the user picked (present once answered); lets us show + edit it.
  chosenOptionId?: string | null;
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

// Readable noun per card type, used in the "apply to the rest" shortcut copy.
const TYPE_NOUN: Record<string, string> = {
  missing_required_skill: 'missing skill',
  similar_skill: 'similar skill',
  certification_risk: 'certification',
  seniority_gap: 'seniority gap',
  knockout_requirement: 'requirement',
};

// Bold the key term(s) inside a card title so the eye lands on the skill/cert
// name instantly. Terms come from the card's structured context.
function highlightTitle(title: string, terms: string[]) {
  const clean = terms.filter((t) => typeof t === 'string' && t.trim().length > 0);
  if (clean.length === 0) return title;
  const escaped = clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const lower = clean.map((t) => t.toLowerCase());
  return title
    .split(re)
    .map((part, i) => (lower.includes(part.toLowerCase()) ? <strong key={i}>{part}</strong> : part));
}

// The context keys that hold the human term worth emphasising in a title.
function titleTerms(payload: CardPayload): string[] {
  const ctx = payload.context ?? {};
  return [ctx.jd_skill, ctx.certification, ctx.profile_skill].filter(
    (t): t is string => typeof t === 'string',
  );
}

// Human label for a card's chosen option (for the "Answered" summary).
function optionLabel(card: Card): string {
  return (card.payload.options ?? []).find((o) => o.option_id === card.chosenOptionId)?.label ?? '';
}

export default function DecisionBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [bulkAnswering, setBulkAnswering] = useState(false);
  // Client-side record of which option was chosen per card type. Powers the
  // "you picked this twice — apply to the rest?" shortcut. Not persisted; a
  // refresh resets it, which is fine (the shortcut is a convenience, not state).
  const [choiceLog, setChoiceLog] = useState<Array<{ cardType: string; optionId: string }>>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  // Which answered card is currently being edited (its options are reopened).
  const [editingId, setEditingId] = useState<string | null>(null);
  // Auto-advance: after answering, scroll the next pending card into view and
  // flash it, so the next click target is always front-and-center.
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  // Screen coords of the last answer click — anchors the repeat-shortcut popover
  // right where the mouse is, so the next action is under the cursor.
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

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

  const answer = async (
    cardId: string,
    optionId: string,
    cardType: string,
    clickPos?: { x: number; y: number },
  ) => {
    if (!sessionId) return;
    // Work out the next pending card now (before it's answered and drops out of
    // the list) so we can scroll to it once the answer lands.
    const pendingNow = (session?.cards ?? []).filter((c) => c.status === 'pending');
    const idx = pendingNow.findIndex((c) => c.id === cardId);
    const nextId =
      pendingNow.slice(idx + 1)[0]?.id ?? pendingNow.find((c) => c.id !== cardId)?.id ?? null;
    setAnswering(cardId);
    setError(null);
    try {
      await api.sessions.answerCard(sessionId, cardId, optionId);
      setChoiceLog((prev) => [...prev, { cardType, optionId }]);
      await fetchSession();
      if (nextId) setFocusId(nextId);
      // Remember where the mouse was; if this answer surfaces a repeat shortcut,
      // its popover appears right here under the cursor.
      if (clickPos) setPopoverPos(clickPos);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to answer');
    } finally {
      setAnswering(null);
    }
  };

  // Answer several cards in sequence, then refetch once. The backend advances
  // the session to STRATEGY_REVIEW after the final pending card is answered, so
  // we fetch only at the end to avoid a premature redirect mid-batch.
  const answerMany = async (items: Array<{ cardId: string; optionId: string; cardType: string }>) => {
    if (!sessionId || items.length === 0) return;
    setBulkAnswering(true);
    setError(null);
    try {
      for (const it of items) {
        await api.sessions.answerCard(sessionId, it.cardId, it.optionId);
      }
      setChoiceLog((prev) => [...prev, ...items.map(({ cardType, optionId }) => ({ cardType, optionId }))]);
      await fetchSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to answer');
    } finally {
      setBulkAnswering(false);
    }
  };

  // Feature 1: apply each pending card's recommended option in one click. Cards
  // with no recommendation, or whose recommendation is a destructive "cancel",
  // are left behind for a deliberate manual tap.
  const applyRecommendedAll = () => {
    const items = (session?.cards ?? [])
      .filter((c) => c.status === 'pending')
      .filter((c) => c.payload.recommended_option && c.payload.recommended_option !== 'cancel')
      .map((c) => ({
        cardId: c.id,
        optionId: c.payload.recommended_option as string,
        cardType: c.cardType,
      }));
    answerMany(items);
  };

  // Feature 2: once the same option has been chosen for 2+ cards of one type,
  // surface a shortcut to apply it to the remaining pending cards of that type.
  const suggestion = useMemo(() => {
    if (!session) return null;
    const pendingCards = session.cards.filter((c) => c.status === 'pending');
    const counts = new Map<string, { cardType: string; optionId: string; n: number }>();
    for (const ch of choiceLog) {
      const key = `${ch.cardType}::${ch.optionId}`;
      const cur = counts.get(key);
      if (cur) cur.n += 1;
      else counts.set(key, { cardType: ch.cardType, optionId: ch.optionId, n: 1 });
    }
    for (const { cardType, optionId, n } of counts.values()) {
      if (n < 2) continue;
      const key = `${cardType}::${optionId}`;
      if (dismissedSuggestions.has(key)) continue;
      const applicable = pendingCards.filter(
        (c) => c.cardType === cardType && (c.payload.options || []).some((o) => o.option_id === optionId),
      );
      if (applicable.length >= 1) {
        const label =
          applicable[0].payload.options?.find((o) => o.option_id === optionId)?.label ?? optionId;
        return { key, cardType, optionId, label, cards: applicable };
      }
    }
    return null;
  }, [session, choiceLog, dismissedSuggestions]);

  useEffect(() => {
    if (!focusId) return;
    cardRefs.current[focusId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setFocusId(null), 900);
    return () => clearTimeout(t);
  }, [focusId]);

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
  const busy = bulkAnswering || answering !== null;
  const total = pending.length + answered.length;
  const bulkEligible = pending.filter(
    (c) => c.payload.recommended_option && c.payload.recommended_option !== 'cancel',
  );

  return (
    <div className="decision-board">
      <div className="board-header">
        <h1>Decision Board</h1>
        <p>Answer the questions below to tailor your resume — nothing goes on your resume until you choose.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {pending.length > 0 ? (
        <div className="board-content">
          <div className="board-content-head">
            <div>
              <h2>Your Decisions</h2>
              <p className="cards-subtitle">
                {pending.length} decision{pending.length !== 1 ? 's' : ''} remaining
              </p>
            </div>
            {bulkEligible.length >= 2 && (
              <button
                className="bulk-accept-btn"
                onClick={applyRecommendedAll}
                disabled={busy}
                title="Applies the safe, recommended choice to each decision. Anything that needs your explicit confirmation is left for you."
              >
                {bulkAnswering ? 'Applying…' : `Use recommended for all (${bulkEligible.length})`}
              </button>
            )}
          </div>

          {total > 1 && (
            <div className="board-progress">
              <div className="board-progress-track">
                <div
                  className="board-progress-fill"
                  style={{ width: `${total ? Math.round((answered.length / total) * 100) : 0}%` }}
                />
              </div>
              <span className="board-progress-label">
                {answered.length} of {total} decided
              </span>
            </div>
          )}

          {pending.map((card) => {
            const options = card.payload.options || [];
            const rec = card.payload.recommended_option;
            const recOpt = rec ? options.find((o) => o.option_id === rec) : undefined;
            // Recommended option first, so the primary click target is always in
            // the same spot (top) and unmistakable.
            const ordered = recOpt ? [recOpt, ...options.filter((o) => o.option_id !== rec)] : options;
            return (
              <div
                key={card.id}
                ref={(el) => {
                  cardRefs.current[card.id] = el;
                }}
                data-severity={card.severity}
                className={`decision-card ${focusId === card.id ? 'card-flash' : ''}`}
              >
                <div className="decision-card-head">
                  <h3>{highlightTitle(card.payload.title ?? '', titleTerms(card.payload))}</h3>
                  <Badge variant={SEVERITY_VARIANT[card.severity] || 'default'}>{card.severity}</Badge>
                </div>
                {card.payload.message && <p className="decision-card-msg">{card.payload.message}</p>}
                <div className="decision-options">
                  {ordered.map((opt) => {
                    const isRec = rec === opt.option_id;
                    return (
                      <button
                        key={opt.option_id}
                        className={`decision-option ${isRec ? 'recommended' : ''}`}
                        disabled={busy}
                        title={opt.consequence || undefined}
                        onClick={(e) =>
                          answer(card.id, opt.option_id, card.cardType, { x: e.clientX, y: e.clientY })
                        }
                      >
                        <span className="opt-label">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
            {answered.map((card) => {
              const editing = editingId === card.id;
              const chosen = optionLabel(card);
              return (
                <div key={card.id} className="default-item">
                  <Badge variant="success">✓</Badge>
                  <div className="default-body">
                    <p className="default-question">{card.payload.title}</p>
                    {editing ? (
                      <div className="decision-options edit-options">
                        {(card.payload.options ?? []).map((opt) => {
                          const isChosen = card.chosenOptionId === opt.option_id;
                          return (
                            <button
                              key={opt.option_id}
                              className={`decision-option ${isChosen ? 'recommended' : ''}`}
                              disabled={busy}
                              title={opt.consequence || undefined}
                              onClick={(e) => {
                                setEditingId(null);
                                answer(card.id, opt.option_id, card.cardType, {
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                              }}
                            >
                              <span className="opt-label">{opt.label}</span>
                            </button>
                          );
                        })}
                        <button className="edit-link" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className="default-choice">
                        {chosen && (
                          <span>
                            You chose <strong>{chosen}</strong>
                          </span>
                        )}
                        <button className="edit-link" onClick={() => setEditingId(card.id)}>
                          Change
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {suggestion && popoverPos && (
        <div
          className="suggestion-popover"
          style={{
            left: Math.min(
              popoverPos.x + 10,
              (typeof window !== 'undefined' ? window.innerWidth : 9999) - 252,
            ),
            top: Math.min(
              popoverPos.y + 10,
              (typeof window !== 'undefined' ? window.innerHeight : 9999) - 130,
            ),
          }}
        >
          <p className="suggestion-popover-text">
            Apply <strong>{suggestion.label}</strong> to the other {suggestion.cards.length}{' '}
            {TYPE_NOUN[suggestion.cardType] ?? 'decision'}
            {suggestion.cards.length !== 1 ? 's' : ''}?
          </p>
          <div className="suggestion-popover-actions">
            <button
              className="repeat-apply"
              disabled={busy}
              onClick={() => {
                answerMany(
                  suggestion.cards.map((c) => ({
                    cardId: c.id,
                    optionId: suggestion.optionId,
                    cardType: c.cardType,
                  })),
                );
                setPopoverPos(null);
              }}
            >
              Apply to {suggestion.cards.length}
            </button>
            <button
              className="repeat-dismiss"
              disabled={busy}
              onClick={() => {
                setDismissedSuggestions((prev) => new Set(prev).add(suggestion.key));
                setPopoverPos(null);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
