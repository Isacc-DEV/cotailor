'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Spinner } from '@/app/components/ui';
import './page.css';

const MAX_CHARS = 15000;

export default function JDInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    setIsClient(true);
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      router.push('/auth/signin');
    }
  }, [router]);

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
      const API = 'http://localhost:3001/api/v1';

      // Figure out which profile to use. If we arrived with an existing session,
      // reuse its profile (and reuse the session only if it's still fresh).
      let profileId: string | null = null;
      let reusableSessionId: string | null = null;

      if (sessionId) {
        const sRes = await fetch(`${API}/sessions/${sessionId}`);
        if (sRes.ok) {
          const s = await sRes.json();
          profileId = s.profileId ?? null;
          // A session can only accept a JD while in CREATED; otherwise start fresh.
          if (s.state === 'CREATED') reusableSessionId = s.id;
        }
      }

      // Fall back to the first profile if we don't have one yet.
      if (!profileId) {
        const profileRes = await fetch(`${API}/profiles`);
        if (!profileRes.ok) throw new Error('No profiles found. Please create a profile first.');
        const profiles = await profileRes.json();
        if (!profiles.length) throw new Error('No profiles found. Please create a profile first.');
        profileId = profiles[0].id;
      }

      // Reuse the fresh session, or create a new one.
      let currentSessionId = reusableSessionId;
      if (!currentSessionId) {
        const sessionRes = await fetch(`${API}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_id: profileId }),
        });
        if (!sessionRes.ok) throw new Error('Failed to create session');
        const newSession = await sessionRes.json();
        currentSessionId = newSession.id || newSession.data?.id;
      }

      if (!currentSessionId) throw new Error('Could not start a session');

      // Submit JD
      const response = await fetch(`${API}/sessions/${currentSessionId}/jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: jdText }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Failed to analyze job description (${response.status})`);
      }

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

  return (
    <div className="jd-input-container">
      <div className="jd-input-main">
        <div className="jd-input-header">
          <h1>Paste Job Description</h1>
          <p>We'll analyze it and match it to your profile</p>
        </div>

        <form onSubmit={handleSubmit} className="jd-input-form">
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
              disabled={loading || !jdText.trim()}
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
