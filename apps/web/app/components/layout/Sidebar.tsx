'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/app/components/ui';
import './sidebar.css';

interface JDHistory {
  id: string;
  profileName: string;
  jdTitle?: string;
  state: string;
  createdAt: string;
  updatedAt: string;
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [history, setHistory] = useState<JDHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Check if we should show sidebar
  const showSidebar =
    pathname?.includes('/jd-input') ||
    pathname?.includes('/decision-board') ||
    pathname?.includes('/strategy-review') ||
    pathname?.includes('/resume-preview');

  useEffect(() => {
    setIsClient(true);
    // Extract session ID from URL if present
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    setCurrentSessionId(params.get('sessionId'));
  }, [pathname]);

  useEffect(() => {
    if (!isClient || !showSidebar) return;

    const fetchJDHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3001/api/v1/sessions', {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Filter sessions that have JD submitted and convert to JD history format
          const jdHistory = Array.isArray(data)
            ? data
                .filter((session: any) => session.jdDocumentId) // Only show sessions with JD
                .map((session: any) => ({
                  id: session.id,
                  profileName: session.profile?.name || 'Unnamed Profile',
                  jdTitle: session.jdDocument?.text?.split('\n')[0]?.substring(0, 60) || 'Job Description',
                  state: session.state,
                  createdAt: session.createdAt,
                  updatedAt: session.updatedAt,
                }))
            : [];
          setHistory(
            jdHistory.sort((a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )
          );
        }
      } catch (error) {
        console.error('Failed to fetch JD history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJDHistory();
  }, [isClient, showSidebar]);

  const handleSessionClick = (sessionId: string) => {
    router.push(`/jd-input?sessionId=${sessionId}`);
    setIsOpen(false);
  };

  const handleNewSession = async () => {
    try {
      // Get the first profile to create a session
      const response = await fetch('http://localhost:3001/api/v1/profiles', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const profiles = await response.json();
        if (profiles.length > 0) {
          // Create session with first profile
          const sessionRes = await fetch('http://localhost:3001/api/v1/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ profile_id: profiles[0].id }),
          });

          if (sessionRes.ok) {
            const session = await sessionRes.json();
            router.push(`/jd-input?sessionId=${session.id}`);
            setIsOpen(false);
            return;
          }
        }
      }
    } catch (error) {
      console.error('Failed to create new session:', error);
    }

    // Fallback to profile selector if no profiles exist
    router.push('/profile-selector');
    setIsOpen(false);
  };

  const getStateLabel = (state: string) => {
    const labels: Record<string, string> = {
      CREATED: 'New',
      JD_SUBMITTED: 'Analyzing',
      ANALYZING: 'Analyzing',
      WAITING_SKILL_DECISIONS: 'Decisions',
      STRATEGY_REVIEW: 'Strategy',
      GENERATING: 'Generating',
      VALIDATING: 'Validating',
      FINAL_READY: 'Ready',
      CATEGORY_REJECTED: 'Rejected',
      CANCELLED: 'Cancelled',
    };
    return labels[state] || state;
  };

  const getStateColor = (state: string) => {
    const colors: Record<string, string> = {
      CREATED: 'state-new',
      JD_SUBMITTED: 'state-analyzing',
      ANALYZING: 'state-analyzing',
      WAITING_SKILL_DECISIONS: 'state-pending',
      STRATEGY_REVIEW: 'state-pending',
      GENERATING: 'state-generating',
      VALIDATING: 'state-generating',
      FINAL_READY: 'state-ready',
      CATEGORY_REJECTED: 'state-error',
      CANCELLED: 'state-error',
    };
    return colors[state] || '';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (!showSidebar) return null;

  return (
    <>
      {/* Mobile toggle button */}
      <button className="sidebar-toggle-mobile" onClick={() => setIsOpen(!isOpen)}>
        <span className="toggle-icon">☰</span>
      </button>

      {/* Sidebar overlay for mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>JD History</h2>
          <button className="close-btn" onClick={() => setIsOpen(false)}>
            ✕
          </button>
        </div>

        <div className="sidebar-actions">
          <Button
            variant="primary"
            size="sm"
            onClick={handleNewSession}
            className="new-session-btn"
          >
            + New Session
          </Button>
        </div>

        <div className="sidebar-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner-small" />
              <p>Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>No JD history yet</p>
              <p className="empty-help">Submit a JD to start tailoring</p>
            </div>
          ) : (
            <div className="sessions-list">
              {history.map((item) => (
                <button
                  key={item.id}
                  className={`session-item ${currentSessionId === item.id ? 'active' : ''}`}
                  onClick={() => handleSessionClick(item.id)}
                  title={`${item.profileName} - ${item.jdTitle}`}
                >
                  <div className="session-item-content">
                    <div className="session-title">{item.profileName}</div>
                    <div className="session-subtitle">{item.jdTitle}</div>
                    <div className="session-meta">
                      <span className={`session-state ${getStateColor(item.state)}`}>
                        {getStateLabel(item.state)}
                      </span>
                      <span className="session-time">{formatDate(item.updatedAt)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <p className="sidebar-hint">Click to resume a session</p>
        </div>
      </aside>
    </>
  );
}
