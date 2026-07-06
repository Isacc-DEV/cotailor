'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button, Badge, Spinner, Card } from '@/app/components/ui';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import { routeForState } from '@/app/lib/session-routes';
import { api } from '@/lib/api-client';
import { formatRelativeTime } from '@/lib/format-time';
import './page.css';

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
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await api.sessions.list();
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

  const handleDeleteSession = async (session: Session) => {
    setDeletingId(session.id);
    setError(null);
    try {
      await api.sessions.delete(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    } finally {
      setDeletingId(null);
    }
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
                  <span className="metadata-value">{formatRelativeTime(session.createdAt)}</span>
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
                <Button
                  variant="danger"
                  size="sm"
                  className="delete-session-btn"
                  loading={deletingId === session.id}
                  onClick={() => setDeleteTarget(session)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete session?"
        message="This permanently removes the session, its decisions, and any generated resume."
        itemName={deleteTarget?.jobTitle}
        confirmText="Delete"
        onConfirm={() => deleteTarget && handleDeleteSession(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
