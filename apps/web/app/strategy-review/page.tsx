'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Button, Spinner, Badge } from '@/app/components/ui';
import { api } from '@/lib/api-client';
import './page.css';

interface PlanItem {
  card_type: string;
  skill?: string;
  decision: string | null;
}
interface Strategy {
  state: string;
  plan: PlanItem[];
}

const DECISION_LABEL: Record<string, string> = {
  exchange: 'Exchange in a bullet',
  both: 'Mention both in a bullet',
  add_experience: 'Add a new bullet',
  skills_only: 'Add to Skills only',
  omit: 'Leave out',
  studying: 'Mark as studying',
  proceed: 'Proceed',
  meet: 'I meet this',
  dont_meet: "Don't meet — continue",
};

export default function StrategyReview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setStrategy(await api.sessions.getStrategy(sessionId));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      router.push('/jd-input');
      return;
    }
    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load strategy'));
  }, [sessionId, load, router]);

  const generate = async () => {
    if (!sessionId) return;
    setGenerating(true);
    setError(null);
    try {
      await api.sessions.generate(sessionId);
      router.push(`/resume-preview?sessionId=${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
      setGenerating(false);
    }
  };

  if (!sessionId) return null;

  if (!strategy) {
    return (
      <div className="strategy-review">
        <div className="strategy-loading">
          {error ? (
            <div className="strategy-error">
              <div className="strategy-error-icon">!</div>
              <h2>Couldn&apos;t load the strategy</h2>
              <div className="strategy-error-detail">{error}</div>
              <div className="strategy-error-actions">
                <Button variant="secondary" onClick={() => router.push(`/decision-board?sessionId=${sessionId}`)}>
                  Back to Decisions
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setError(null);
                    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load strategy'));
                  }}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <Spinner text="Loading strategy..." />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="strategy-review">
      <div className="strategy-header">
        <h1>Review Your Strategy</h1>
        <p>Here's how each decision will shape your resume. Approve to generate.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="strategy-plan">
        {strategy.plan.length === 0 ? (
          <p className="strategy-empty">No skill adjustments were needed — your profile already fits.</p>
        ) : (
          strategy.plan.map((item, idx) => (
            <div key={idx} className="strategy-row">
              <span className="strategy-skill">{item.skill}</span>
              <Badge variant={item.decision === 'omit' ? 'default' : 'info'}>
                {DECISION_LABEL[item.decision || ''] || item.decision}
              </Badge>
            </div>
          ))
        )}
      </div>

      <div className="strategy-actions">
        <Button
          variant="secondary"
          onClick={() => router.push(`/decision-board?sessionId=${sessionId}`)}
          disabled={generating}
        >
          Adjust Decisions
        </Button>
        <Button variant="primary" size="lg" onClick={generate} loading={generating} disabled={generating}>
          {generating ? 'Generating…' : 'Approve & Generate Resume'}
        </Button>
      </div>
    </div>
  );
}
