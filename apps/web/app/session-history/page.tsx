'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button, Badge, Spinner, Card } from '@/app/components/ui';
import { routeForState } from '@/app/lib/session-routes';
import './page.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface Session {
  id: string;
  state: string;
  profileName: string;
  jobTitle: string;
  company?: string;
  createdAt: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  matchScore?: number;
  decisionsMade?: number;
  totalDecisions?: number;
}

const ABANDONED_STATES = new Set(['CANCELLED', 'EXPIRED', 'CATEGORY_REJECTED']);

function statusOf(state: string): Session['status'] {
  if (state === 'FINAL_READY') return 'completed';
  if (ABANDONED_STATES.has(state)) return 'abandoned';
  return 'in_progress';
}

export default function SessionHistory() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch(`${API}/sessions`);
        if (!res.ok) throw new Error(`Failed to load sessions (${res.status})`);
        const data = await res.json();
        setSessions(
          (Array.isArray(data) ? data : []).map((s: any) => ({
            id: s.id,
            state: s.state,
            profileName: s.profile?.name || 'Profile',
            jobTitle:
              s.jobTitle ||
              s.jdDocument?.text?.split('\n')[0]?.trim().slice(0, 60) ||
              'No job description yet',
            createdAt: s.createdAt,
            status: statusOf(s.state),
            decisionsMade: s.cardsAnswered,
            totalDecisions: s.cardsTotal,
          })),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session history');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const filteredSessions = sessions.filter((s) => filter === 'all' || s.status === filter);

  const getStatusBadgeVariant = (status: Session['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'info';
      case 'abandoned':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: Session['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'abandoned':
        return 'Abandoned';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins}m ago`;
      }
      return `${diffHours}h ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleResumeSession = (session: Session) => {
    if (session.status === 'completed') {
      router.push(`/resume-preview?sessionId=${session.id}`);
    } else if (session.status === 'in_progress') {
      router.push(routeForState(session.state, session.id));
    }
  };

  return (
    <div className="session-history">
      <div className="history-header">
        <h1>Session History</h1>
        <p>View and manage your past tailoring sessions</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filter-controls">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Sessions ({sessions.length})
        </button>
        <button
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed ({sessions.filter((s) => s.status === 'completed').length})
        </button>
        <button
          className={`filter-btn ${filter === 'in_progress' ? 'active' : ''}`}
          onClick={() => setFilter('in_progress')}
        >
          In Progress ({sessions.filter((s) => s.status === 'in_progress').length})
        </button>
      </div>

      {loading ? (
        <Spinner text="Loading sessions..." />
      ) : filteredSessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h2>No sessions yet</h2>
          <p>Start a new tailoring session to see it here</p>
          <Button variant="primary" size="lg" onClick={() => router.push('/profile-selector')}>
            Create New Session
          </Button>
        </div>
      ) : (
        <div className="sessions-list">
          {filteredSessions.map((session) => (
            <Card key={session.id} className="session-card" hoverable>
              <div className="session-card-header">
                <div className="session-titles">
                  <h3>{session.jobTitle}</h3>
                  {session.company && <p className="company-name">{session.company}</p>}
                </div>
                <Badge variant={getStatusBadgeVariant(session.status)}>{getStatusLabel(session.status)}</Badge>
              </div>

              <div className="session-metadata">
                <div className="metadata-item">
                  <span className="metadata-label">Profile</span>
                  <span className="metadata-value">{session.profileName}</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">Created</span>
                  <span className="metadata-value">{formatDate(session.createdAt)}</span>
                </div>
                {session.status === 'completed' && session.matchScore !== undefined && (
                  <div className="metadata-item">
                    <span className="metadata-label">Match Score</span>
                    <span className="metadata-value match-score">{session.matchScore}%</span>
                  </div>
                )}
                {session.status === 'in_progress' && session.decisionsMade !== undefined && (
                  <div className="metadata-item">
                    <span className="metadata-label">Progress</span>
                    <span className="metadata-value">
                      {session.decisionsMade}/{session.totalDecisions}
                    </span>
                  </div>
                )}
              </div>

              {session.status === 'in_progress' && session.totalDecisions && (
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${((session.decisionsMade || 0) / session.totalDecisions) * 100}%`,
                    }}
                  />
                </div>
              )}

              <div className="session-actions">
                {session.status === 'completed' ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleResumeSession(session)}
                    >
                      View Resume
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => router.push(`/resume-preview?sessionId=${session.id}&export=true`)}>
                      Export
                    </Button>
                  </>
                ) : session.status === 'in_progress' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleResumeSession(session)}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push('/profile-selector')}
                  >
                    Start New Session
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
