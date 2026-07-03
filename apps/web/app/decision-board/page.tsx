'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useCards } from '@/app/hooks/useCards';
import { DecisionCard } from '@/app/components/cards/DecisionCard';
import { Button, Spinner, Badge } from '@/app/components/ui';
import './page.css';

export default function DecisionBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const {
    pendingCards,
    autoResolvedCards,
    allAnswered,
    loading,
    error,
    answerCard,
  } = useCards(sessionId);

  useEffect(() => {
    if (!sessionId) {
      router.push('/profile-selector');
    }
  }, [sessionId, router]);

  const handleAnswerCard = async (cardId: string, response: string) => {
    try {
      await answerCard(cardId, response);
    } catch (err) {
      console.error('Error answering card:', err);
    }
  };

  const handleReviewStrategy = () => {
    if (sessionId) {
      router.push(`/strategy-review?sessionId=${sessionId}`);
    }
  };

  return (
    <div className="decision-board">
      <div className="board-header">
        <h1>Decision Board</h1>
        <p>Answer the questions below to tailor your resume</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <Spinner text="Loading decisions..." />
      ) : (
        <>
          {/* Assumed Defaults Section */}
          {autoResolvedCards.length > 0 && (
            <div className="assumed-defaults">
              <h2>Assumed Defaults</h2>
              <p className="defaults-subtitle">These decisions were made automatically for you</p>
              <div className="defaults-list">
                {autoResolvedCards.map((card) => (
                  <div key={card.id} className="default-item">
                    <Badge variant="success">✓</Badge>
                    <div>
                      <p className="default-question">{card.question}</p>
                      {card.consequence && <p className="default-consequence">{card.consequence}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Cards Section */}
          {pendingCards.length > 0 ? (
            <>
              <div className="board-content">
                <h2>Your Decisions</h2>
                <p className="cards-subtitle">
                  {pendingCards.length} decision{pendingCards.length !== 1 ? 's' : ''} remaining
                </p>

                {pendingCards.map((card) => (
                  <DecisionCard
                    key={card.id}
                    card={card}
                    onAnswer={handleAnswerCard}
                    answered={false}
                  />
                ))}
              </div>

              <div className="board-footer">
                <Button
                  variant="primary"
                  size="lg"
                  disabled={!allAnswered || loading}
                  onClick={handleReviewStrategy}
                >
                  Review Strategy
                </Button>
              </div>
            </>
          ) : (
            <div className="all-answered">
              <div className="success-icon">✓</div>
              <h2>All decisions answered</h2>
              <p>Your strategy is being generated...</p>
              <Button
                variant="primary"
                size="lg"
                onClick={handleReviewStrategy}
              >
                Review Strategy
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
