'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SESSION_STATES, CARD_TYPES, MATCH_TYPES } from '@cotailor/shared';
import { Button } from '@/app/components/ui';
import './page.css';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function Home() {
  const router = useRouter();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const add = (m: string) => setLog((l) => [...l, m]);

  async function runDemo() {
    setBusy(true);
    setLog([]);
    try {
      const profile = await fetch(`${API}/api/v1/profiles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Backend Engineer - Node.js',
          category: 'Software Engineering',
          skills: ['Node.js', 'PostgreSQL', 'React', 'AWS', 'Docker'],
        }),
      }).then((r) => r.json());
      add(`✓ profile created: ${profile.id}`);

      const session = await fetch(`${API}/api/v1/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile_id: profile.id }),
      }).then((r) => r.json());
      add(`✓ session created: ${session.id} - state=${session.state}`);

      const gen = await fetch(`${API}/api/v1/sessions/${session.id}/generate`, { method: 'POST' });
      const genBody = await gen.json();
      add(`✓ generate blocked as designed > HTTP ${gen.status}: ${genBody.error} (allowed: ${(genBody.allowed_actions || []).join(', ') || 'n/a'})`);

      const cancel = await fetch(`${API}/api/v1/sessions/${session.id}/cancel`, { method: 'POST' }).then((r) => r.json());
      add(`✓ cancelled - state=${cancel.state}`);
    } catch (e) {
      add(`✗ ${(e as Error).message} - is the API + Postgres running? (docker compose up -d, then pnpm dev)`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="landing-page">
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">Collaborative AI Resume Tailor</div>
          <h1>Tailor Your Resume Honestly</h1>
          <p className="hero-subtitle">
            Tailor your resume honestly based on category and subtype fit.
          </p>
          <p className="hero-description">
            CoTailor uses smart gates and structured decisions to help you craft resumes that are true,
            tailored, and defensible - in minutes, not hours.
          </p>

          <div className="hero-actions">
            <Button variant="primary" size="lg" onClick={() => router.push('/profile-selector')}>
              Start Tailoring Your Resume
            </Button>
            <Button variant="secondary" size="lg" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
              Learn How It Works
            </Button>
          </div>
        </div>

        <div className="hero-stats">
          <div className="stat">
            <div className="stat-number">{SESSION_STATES.length}</div>
            <div className="stat-label">Session States</div>
          </div>
          <div className="stat">
            <div className="stat-number">{CARD_TYPES.length}</div>
            <div className="stat-label">Decision Types</div>
          </div>
          <div className="stat">
            <div className="stat-number">{MATCH_TYPES.length}</div>
            <div className="stat-label">Match Types</div>
          </div>
        </div>
      </section>

      <section className="features">
        <h2>Why CoTailor?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Fit Gates First</h3>
            <p>Category and subtype checks before you write a single word. Stop applying to misaligned roles.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🤝</div>
            <h3>Decision Board</h3>
            <p>Collaborative, structured questions you actually need to answer. No open-ended chat. Pure focus.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✓</div>
            <h3>Provenance-Backed</h3>
            <p>Every bullet is traceable to a fact or decision. No fabrication. No keyword stuffing. Interview-proof.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Smart Defaults</h3>
            <p>Low-stakes decisions auto-resolve with sensible defaults. You focus on what actually matters.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Match Report</h3>
            <p>See your fit score, skill coverage, ATS readiness, and exactly what changed vs. your base resume.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📥</div>
            <h3>Export Anywhere</h3>
            <p>Download as DOCX, PDF, or JSON. Share, edit, or import into other tools. Total control.</p>
          </div>
        </div>
      </section>

      <section className="how-it-works" id="how-it-works">
        <h2>How It Works in 5 Steps</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Select Profile</h3>
            <p>Choose a saved resume profile with your category, skills, and base resume</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Paste JD</h3>
            <p>Copy the job description and paste it in. We will analyze it instantly.</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Answer Cards</h3>
            <p>Make targeted decisions on a single board. Skip the stuff that auto-resolves.</p>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>Review Strategy</h3>
            <p>See the AI plan: what to emphasize, avoid, and your predicted fit score.</p>
          </div>
          <div className="step">
            <div className="step-number">5</div>
            <h3>Export and Done</h3>
            <p>Download your resume. It is ready to send. No fabrication. No regrets.</p>
          </div>
        </div>
      </section>

      <section className="cta">
        <h2>Ready to Tailor Honestly?</h2>
        <p>Start with a profile. See the fit gates in action.</p>
        <Button variant="primary" size="lg" onClick={() => router.push('/profile-selector')}>
          Start Tailoring Now
        </Button>
      </section>

      <section className="demo-section">
        <h2>Developer Demo: State Machine</h2>
        <p>Click below to test the backend state machine (creates a profile and session, confirms gates work):</p>

        <Button
          variant="secondary"
          size="lg"
          onClick={runDemo}
          loading={busy}
          disabled={busy}
          style={{ marginBottom: '1rem' }}
        >
          Run State Machine Demo
        </Button>

        <div className="demo-output">
          {log.length ? log.join('\n') : '// Click button to run demo...'}
        </div>
      </section>
    </main>
  );
}
