'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api-client';
import { formatRelativeTime } from '@/lib/format-time';
import { AUTH_CHANGED_EVENT, clearAuth, getStoredUser, type AuthUser } from '@/lib/auth';
import { routeForState } from '@/app/lib/session-routes';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import './sidebar.css';

interface JDHistory {
  id: string;
  profileId?: string;
  profileName: string;
  jdTitle?: string;
  state: string;
  createdAt: string;
  updatedAt: string;
}

interface ProfileLite {
  id: string;
  name: string;
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<JDHistory[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JDHistory | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // ChatGPT-style account popover: clicking anywhere else closes it.
  useEffect(() => {
    if (!accountMenuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [accountMenuOpen]);

  useEffect(() => {
    setIsClient(true);
    const sync = () => setUser(getStoredUser());
    sync();
    // Stays in sync with signin/signout without a full page reload.
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    // Extract session ID from URL if present
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    setCurrentSessionId(params.get('sessionId'));
  }, [pathname]);

  useEffect(() => {
    if (!isClient || !user) {
      setHistory([]);
      setProfiles([]);
      return;
    }

    let stale = false;
    const fetchJDHistory = async () => {
      try {
        setLoading(true);
        const [data, profileList] = await Promise.all([
          api.sessions.list(),
          api.profiles.list().catch(() => []),
        ]);
        if (!stale) {
          setProfiles(
            (Array.isArray(profileList) ? profileList : []).map((p: any) => ({ id: p.id, name: p.name })),
          );
        }
        const jdHistory = (Array.isArray(data) ? data : [])
          .filter((session: any) => session.jdDocumentId) // Only show sessions with JD
          .map((session: any) => ({
            id: session.id,
            profileId: session.profileId,
            profileName: session.profile?.name || 'Unnamed Profile',
            jdTitle: session.jdDocument?.text?.split('\n')[0]?.substring(0, 60) || 'Job Description',
            state: session.state,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          }));
        if (!stale) {
          setHistory(
            jdHistory.sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            ),
          );
        }
      } catch (error) {
        console.error('Failed to fetch JD history:', error);
      } finally {
        if (!stale) setLoading(false);
      }
    };

    fetchJDHistory();
    return () => {
      stale = true;
    };
  }, [isClient, user, pathname]);

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  // Open the session where it left off — finished ones go straight to the resume.
  const handleSessionClick = (sessionId: string, state: string) => {
    router.push(routeForState(state, sessionId));
    setIsOpen(false);
  };

  const handleDeleteSession = async (item: JDHistory) => {
    try {
      await api.sessions.delete(item.id);
      setHistory((prev) => prev.filter((s) => s.id !== item.id));
      // The deleted session may be the one on screen — leave before it 404s.
      if (currentSessionId === item.id) {
        router.push('/jd-input');
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleSignOut = () => {
    clearAuth();
    setUser(null);
    router.push('/');
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

  // Auth screens are the only places without the sidebar (ChatGPT-style shell).
  if (pathname?.startsWith('/auth')) return null;

  const displayName = user ? user.name || user.email : '';

  // Up to 3 profiles for one-click session starts: most recently used first
  // (from session history), padded with unused profiles. Hidden with fewer
  // than 2 profiles — the JD page already defaults to the only one.
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const lastUsedProfileId = history.find((s) => s.profileId && profileById.has(s.profileId))?.profileId ?? null;
  const recentProfiles: ProfileLite[] = [];
  if (profiles.length >= 2) {
    const seen = new Set<string>();
    for (const s of history) {
      if (recentProfiles.length === 3) break;
      const p = s.profileId ? profileById.get(s.profileId) : undefined;
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        recentProfiles.push(p);
      }
    }
    for (const p of profiles) {
      if (recentProfiles.length === 3) break;
      if (!seen.has(p.id)) {
        seen.add(p.id);
        recentProfiles.push(p);
      }
    }
  }

  return (
    <>
      {/* Mobile toggle button */}
      <button className="sidebar-toggle-mobile" onClick={() => setIsOpen(!isOpen)} aria-label="Open menu">
        <span className="toggle-icon">☰</span>
      </button>

      {/* Sidebar overlay for mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <button className="brand-link" onClick={() => handleNavigation('/')}>
            <span className="brand-icon">C</span>
            <span className="brand-text">CoTailor</span>
          </button>
          <button className="close-btn" onClick={() => setIsOpen(false)} aria-label="Close menu">
            ✕
          </button>
        </div>

        {isClient && user && (
          <nav className="sidebar-nav">
            {/* Straight to the composer — profile choice is a pill on that page. */}
            <button className="sidebar-nav-link nav-new-session" onClick={() => handleNavigation('/jd-input')}>
              <span className="nav-icon">+</span> New session
            </button>
            {recentProfiles.map((p) => (
              <button
                key={p.id}
                className="sidebar-nav-link nav-profile"
                onClick={() => handleNavigation(`/jd-input?profileId=${p.id}`)}
                title={`New session as ${p.name}`}
              >
                <span className="nav-profile-avatar">{p.name.charAt(0).toUpperCase()}</span>
                <span className="nav-profile-name">{p.name}</span>
                {p.id === lastUsedProfileId && (
                  <span className="nav-profile-last" title="Last used">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}

        <div className="sidebar-content">
          {isClient && user ? (
            loading ? (
              <div className="loading-state">
                <div className="spinner-small" />
                <p>Loading history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="empty-state">
                <p>No sessions yet</p>
                <p className="empty-help">Submit a JD to start tailoring</p>
              </div>
            ) : (
              <>
                <div className="sidebar-section-header">
                  <span className="sidebar-section-label">Recent</span>
                  <button className="view-all-link" onClick={() => handleNavigation('/session-history')}>
                    View all
                  </button>
                </div>
                <div className="sessions-list">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className={`session-item-row ${currentSessionId === item.id ? 'active' : ''}`}
                    >
                      <button
                        className="session-item"
                        onClick={() => handleSessionClick(item.id, item.state)}
                        title={`${item.profileName} - ${item.jdTitle}`}
                      >
                        <div className="session-item-content">
                          <div className="session-title">{item.profileName}</div>
                          <div className="session-subtitle">{item.jdTitle}</div>
                          <div className="session-meta">
                            <span className={`session-state ${getStateColor(item.state)}`}>
                              {getStateLabel(item.state)}
                            </span>
                            <span className="session-time">{formatRelativeTime(item.updatedAt)}</span>
                          </div>
                        </div>
                      </button>
                      <button
                        className="session-delete-btn"
                        onClick={() => setDeleteTarget(item)}
                        aria-label={`Delete session: ${item.jdTitle}`}
                        title="Delete session"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )
          ) : null}
        </div>

        <div className="sidebar-footer">
          {isClient && user ? (
            <div className="account" ref={accountRef}>
              {accountMenuOpen && (
                <div className="account-menu" role="menu">
                  <button
                    className="account-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      handleNavigation('/profile-selector');
                    }}
                  >
                    <span className="account-menu-icon icon-profiles" aria-hidden="true" />
                    <span>Profiles</span>
                  </button>
                  <button
                    className="account-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      handleNavigation('/settings');
                    }}
                  >
                    <span className="account-menu-icon icon-settings" aria-hidden="true" />
                    <span>Settings</span>
                  </button>
                  {user.role === 'admin' && (
                    <button
                      className="account-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        handleNavigation('/admin');
                      }}
                    >
                      <span className="account-menu-icon icon-manage" aria-hidden="true" />
                      <span>Manage</span>
                    </button>
                  )}
                  <div className="account-menu-divider" />
                  <button
                    className="account-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      handleSignOut();
                    }}
                  >
                    <span className="account-menu-icon icon-signout" aria-hidden="true" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
              <button
                className={`account-row ${accountMenuOpen ? 'open' : ''}`}
                title={displayName}
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
              >
                <span className="account-avatar">{displayName.charAt(0).toUpperCase()}</span>
                <span className="account-name">{displayName}</span>
                <span className="account-caret">⋯</span>
              </button>
            </div>
          ) : isClient ? (
            <div className="sidebar-auth-actions">
              <button className="auth-btn auth-btn-primary" onClick={() => handleNavigation('/auth/signup')}>
                Sign up
              </button>
              <button className="auth-btn auth-btn-secondary" onClick={() => handleNavigation('/auth/signin')}>
                Sign in
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete session?"
        message="This permanently removes the session, its decisions, and any generated resume."
        itemName={deleteTarget?.jdTitle}
        confirmText="Delete"
        onConfirm={() => deleteTarget && handleDeleteSession(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
