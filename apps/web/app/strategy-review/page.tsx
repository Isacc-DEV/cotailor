'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useStrategy } from '@/app/hooks/useStrategy';
import { Button, Spinner, Badge } from '@/app/components/ui';
import './page.css';

export default function StrategyReview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [approving, setApproving] = useState(false);

  const { strategy, loading, error, approveStrategy } = useStrategy(sessionId);

  useEffect(() => {
    if (!sessionId) {
      router.push('/profile-selector');
    }
  }, [sessionId, router]);

  const handleApprove = async () => {
    if (!sessionId) return;

    setApproving(true);
    try {
      await approveStrategy();
      // Redirect to loading screen, then to resume preview
      router.push(`/resume-preview?sessionId=${sessionId}`);
    } catch (err) {
      console.error('Error approving strategy:', err);
    } finally {
      setApproving(false);
    }
  };

  const handleAdjust = () => {
    if (sessionId) {
      router.push(`/decision-board?sessionId=${sessionId}`);
    }
  };

  return (
    <div className="strategy-review">
      <div className="review-header">
        <h1>Review Your Strategy</h1>
        <p>Approve this approach or adjust your decisions</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <Spinner text="Loading strategy..." />
      ) : strategy ? (
        <>
          <div className="strategy-container">
            {/* Left Column: Strategy Details */}
            <div className="strategy-details">
              {/* Target Title */}
              <div className="strategy-section">
                <h2>Target Job Title</h2>
                <p className="strategy-value">{strategy.targetTitle}</p>
              </div>

              {/* Emphasis */}
              <div className="strategy-section">
                <h2>What to Emphasize</h2>
                <ul className="strategy-list">
                  {strategy.emphasis.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Avoid */}
              <div className="strategy-section">
                <h2>What to De-emphasize</h2>
                <ul className="strategy-list avoid">
                  {strategy.avoid.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Per-Role Plan */}
              <div className="strategy-section">
                <h2>Tailoring Plan</h2>
                <p className="strategy-description">{strategy.perRolePlan}</p>
              </div>

              {/* Resume Style */}
              <div className="strategy-section">
                <h2>Resume Style</h2>
                <div className="style-badge">
                  <Badge variant="info">
                    {strategy.style.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Right Column: Predicted Score */}
            <div className="strategy-score">
              <div className="score-card">
                <h3>Predicted Match Score</h3>
                <div className="score-gauge">
                  <div className="score-circle">
                    <div className="score-value">{strategy.predictedScore}</div>
                    <div className="score-max">/100</div>
                  </div>
                  <div className="score-bar">
                    <div
                      className={`score-bar-fill score-${
                        strategy.predictedScore >= 80
                          ? 'good'
                          : strategy.predictedScore >= 60
                          ? 'fair'
                          : 'poor'
                      }`}
                      style={{ width: `${strategy.predictedScore}%` }}
                    />
                  </div>
                  <p className="score-label">
                    {strategy.predictedScore >= 80
                      ? 'Strong Match'
                      : strategy.predictedScore >= 60
                      ? 'Fair Match'
                      : 'Weak Match'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Assumed Defaults */}
          {strategy.assumedDefaults && strategy.assumedDefaults.length > 0 && (
            <div className="assumed-defaults-section">
              <h2>Assumed Defaults</h2>
              <p className="defaults-subtitle">Automatic decisions made on your behalf</p>
              <div className="defaults-items">
                {strategy.assumedDefaults.map((item) => (
                  <div key={item.cardId} className="default-item">
                    <div className="default-action">{item.action}</div>
                    <div className="default-reason">{item.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="review-actions">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleAdjust}
              disabled={approving}
            >
              ← Adjust Answers
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={handleApprove}
              loading={approving}
              disabled={approving}
            >
              Approve & Generate Resume
            </Button>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>No strategy available. Please complete the decision board.</p>
          <Button variant="primary" onClick={handleAdjust}>
            Back to Decisions
          </Button>
        </div>
      )}
    </div>
  );
}
