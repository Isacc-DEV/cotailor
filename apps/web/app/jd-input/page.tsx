'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Spinner } from '@/app/components/ui';
import { api } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import './page.css';

const MAX_CHARS = 15000;
const LAST_PROFILE_KEY = 'last_profile_id';

interface ProfileOption {
  id: string;
  name: string;
  category?: string;
}

export default function JDInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  // Explicit profile choice carried in from the sidebar's one-click profile rows.
  const requestedProfileId = searchParams.get('profileId');

  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [charCount, setCharCount] = useState(0);

  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // A session that arrived via ?sessionId= and is still fresh enough to accept a JD.
  const [reusableSession, setReusableSession] = useState<{ id: string; profileId: string } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    if (!getToken()) {
      router.push('/auth/signin');
      return;
    }

    let stale = false;
    (async () => {
      try {
        setProfilesLoading(true);
        const [rawList, session, sessions] = await Promise.all([
          api.profiles.list(),
          sessionId ? api.sessions.get(sessionId).catch(() => null) : Promise.resolve(null),
          api.sessions.list().catch(() => []),
        ]);
        if (stale) return;

        // Most-likely profile first: order the picker by recent use (sessions
        // arrive newest-first); never-used profiles keep their original order.
        const lastUse = new Map<string, number>();
        (Array.isArray(sessions) ? sessions : []).forEach((s: any, i: number) => {
          if (s.profileId && !lastUse.has(s.profileId)) lastUse.set(s.profileId, i);
        });
        const list = [...rawList].sort(
          (a: ProfileOption, b: ProfileOption) =>
            (lastUse.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (lastUse.get(b.id) ?? Number.MAX_SAFE_INTEGER),
        );

        setProfiles(list);
        // A session can only accept a JD while in CREATED; otherwise we start fresh.
        if (session && session.state === 'CREATED' && session.profileId) {
          setReusableSession({ id: session.id, profileId: session.profileId });
        }

        const lastUsed = typeof window !== 'undefined' ? localStorage.getItem(LAST_PROFILE_KEY) : null;
        const preferred =
          (requestedProfileId && list.find((p: ProfileOption) => p.id === requestedProfileId)?.id) ||
          (session?.profileId && list.find((p: ProfileOption) => p.id === session.profileId)?.id) ||
          (lastUsed && list.find((p: ProfileOption) => p.id === lastUsed)?.id) ||
          list[0]?.id ||
          null;
        setSelectedProfileId(preferred);
      } catch (err) {
        if (!stale) setError(err instanceof Error ? err.message : 'Failed to load profiles');
      } finally {
        if (!stale) setProfilesLoading(false);
      }
    })();

    return () => {
      stale = true;
    };
  }, [router, sessionId, requestedProfileId]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [pickerOpen]);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) ?? null;

  const handleJDChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= MAX_CHARS) {
      setJdText(text);
      setCharCount(text.length);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProfileId) {
      setError('Select a profile first');
      return;
    }

    if (!jdText.trim()) {
      setError('Please paste a job description');
      return;
    }

    if (jdText.length < 100) {
      setError('Job description seems too short. Please provide more details.');
      return;
    }

    setLoading(true);

    try {
      // Reuse the fresh session only if the user kept its profile; otherwise create a new one.
      let currentSessionId =
        reusableSession && reusableSession.profileId === selectedProfileId ? reusableSession.id : null;

      if (!currentSessionId) {
        const session = await api.sessions.create(selectedProfileId);
        currentSessionId = session?.id ?? null;
      }

      if (!currentSessionId) throw new Error('Could not start a session');

      localStorage.setItem(LAST_PROFILE_KEY, selectedProfileId);

      await api.sessions.submitJD(currentSessionId, jdText);
      router.push(`/decision-board?sessionId=${currentSessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isClient) {
    return <Spinner text="Loading..." />;
  }

  if (!profilesLoading && profiles.length === 0) {
    return (
      <div className="jd-input-container">
        <div className="jd-input-main">
          <div className="jd-empty-profiles">
            <h1>Create a profile to get started</h1>
            <p>Your profile holds the verified experience and skills every resume is built from.</p>
            <Button variant="primary" size="lg" onClick={() => router.push('/create-profile')}>
              Create Profile
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="jd-input-container">
      <div className="jd-input-main">
        <div className="jd-input-header">
          <h1>Tailor a resume</h1>
          <p>Paste a job description and we&apos;ll check the fit before writing a word</p>
        </div>

        <form onSubmit={handleSubmit} className="jd-input-form">
          <div className="profile-picker" ref={pickerRef}>
            <button
              type="button"
              className="profile-pill"
              onClick={() => setPickerOpen(!pickerOpen)}
              disabled={loading || profilesLoading}
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
            >
              <span className="pill-prefix">Profile</span>
              <span className="pill-name">
                {profilesLoading ? 'Loading…' : selectedProfile ? selectedProfile.name : 'Select profile'}
              </span>
              <span className="pill-caret">▾</span>
            </button>

            {pickerOpen && (
              <div className="profile-menu" role="listbox">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    role="option"
                    aria-selected={profile.id === selectedProfileId}
                    className={`profile-option ${profile.id === selectedProfileId ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedProfileId(profile.id);
                      setPickerOpen(false);
                    }}
                  >
                    <span className="option-main">
                      <span className="option-name">{profile.name}</span>
                      {profile.category && <span className="option-category">{profile.category}</span>}
                    </span>
                    {profile.id === selectedProfileId && <span className="option-check">✓</span>}
                  </button>
                ))}
                <div className="profile-menu-divider" />
                <button type="button" className="profile-option menu-action" onClick={() => router.push('/create-profile')}>
                  + New profile
                </button>
                <button type="button" className="profile-option menu-action" onClick={() => router.push('/profile-selector')}>
                  Manage profiles
                </button>
              </div>
            )}
          </div>

          <div className="jd-input-group">
            <textarea
              value={jdText}
              onChange={handleJDChange}
              placeholder="Paste the job description here. Include title, responsibilities, requirements, nice-to-haves, and any other details..."
              className="jd-textarea"
              disabled={loading}
              rows={16}
            />
            <div className="jd-char-count">
              {charCount} / {MAX_CHARS} characters
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="jd-input-actions">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading || !jdText.trim() || !selectedProfileId}
              loading={loading}
            >
              {loading ? 'Analyzing...' : 'Analyze & Continue'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => {
                setJdText('');
                setCharCount(0);
                setError(null);
              }}
              disabled={loading || !jdText}
            >
              Clear
            </Button>
          </div>

          <div className="jd-help">
            <p><strong>💡 Include:</strong></p>
            <ul>
              <li>Job title and company</li>
              <li>Required skills and technologies</li>
              <li>Responsibilities and qualifications</li>
              <li>Nice-to-have skills</li>
            </ul>
          </div>
        </form>
      </div>
    </div>
  );
}
