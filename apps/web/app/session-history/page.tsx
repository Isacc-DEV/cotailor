'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button, Badge, Spinner, Card } from '@/app/components/ui';
import './page.css';

interface Session {
  id: string;
  profileName: string;
  jobTitle: string;
  company?: string;
  createdAt: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  matchScore?: number;
  decisionsMade?: number;
  totalDecisions?: number;
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
        // Mock data - replace with actual API call
        setSessions([
          {
            id: 'sess_001',
            profileName: 'Senior Backend Engineer',
            jobTitle: 'Full Stack Engineer',
            company: 'TechCorp',
            createdAt: '2024-12-15T14:30:00Z',
            status: 'completed',
            matchScore: 87,
            decisionsMade: 10,
            totalDecisions: 10,
          },
          {
            id: 'sess_002',
            profileName: 'Senior Backend Engineer',
            jobTitle: 'Principal Engineer',
            company: 'StartupXYZ',
            createdAt: '2024-12-14T10:15:00Z',
            status: 'completed',
            matchScore: 72,
            decisionsMade: 10,
            totalDecisions: 10,
          },
          {
            id: 'sess_003',
            profileName: 'Product Manager',
            jobTitle: 'Product Manager',
            company: 'BigTech',
            createdAt: '2024-12-13T16:45:00Z',
            status: 'in_progress',
            decisionsMade: 6,
            totalDecisions: 10,
          },
          {
            id: 'sess_004',
            profileName: 'Senior Backend Engineer',
            jobTitle: 'DevOps Engineer',
            company: 'CloudServices',
            createdAt: '2024-12-12T09:00:00Z',
            status: 'abandoned',
          },
        ]);
      } catch (err) {
        setError('Failed to load session history');
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

  const handleResumeSession = (sessionId: string, status: Session['status']) => {
    if (status === 'completed') {
      router.push(`/resume-preview?sessionId=${sessionId}`);
    } else if (status === 'in_progress') {
      router.push(`/decision-board?sessionId=${sessionId}`);
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
                      onClick={() => handleResumeSession(session.id, session.status)}
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
                    onClick={() => handleResumeSession(session.id, session.status)}
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
