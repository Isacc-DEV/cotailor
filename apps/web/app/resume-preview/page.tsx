'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Button, Spinner, Badge } from '@/app/components/ui';
import { formatDateRange } from '@/app/lib/date-format';
import { api } from '@/lib/api-client';
import './page.css';

interface Bullet {
  text: string;
  provenance: 'profile_verified' | 'user_confirmed';
  originalText?: string;
  added?: boolean;
}
interface Experience {
  company: string;
  position?: string;
  startDate?: string;
  endDate?: string | null;
  location?: string;
  bullets: Bullet[];
  technologies?: string[];
  impact?: string;
}
interface ChangeLogEntry {
  skill: string;
  action: string;
  where: string;
}
interface QualityIssue {
  type: string;
  severity: 'info' | 'warning';
  where: string;
  text?: string;
  message: string;
  expIndex?: number;
  bulletIndex?: number;
  targets?: Array<{ expIndex: number; bulletIndex: number }>;
}
interface QualityReport {
  issues: QualityIssue[];
  passed: boolean;
}
interface Resume {
  header: Record<string, any>;
  summary?: string;
  skills: string[];
  workExperience: Experience[];
  education: any[];
  certifications: any[];
  changeLog: ChangeLogEntry[];
  qualityReport?: QualityReport;
}

interface EditingState {
  expIndex: number;
  bulletIndex: number;
  value: string;
  fromAI?: boolean;
  aiVerified?: boolean;
}

// The lint types the AI can fix per-bullet (formatting is fixed deterministically).
const AI_FIXABLE = new Set(['buzzword', 'weak_phrase', 'repeated_first_word']);
const FORMATTING = new Set(['punctuation_inconsistent', 'capitalization']);

function fixInstruction(issue: QualityIssue): string {
  switch (issue.type) {
    case 'buzzword':
      return `Remove the cliché "${issue.text}" and replace it with plain, concrete wording. Keep all facts and technologies exactly as they are.`;
    case 'weak_phrase':
      return `Rewrite to lead with a strong action verb instead of "${issue.text}". Keep all facts and technologies exactly as they are.`;
    case 'repeated_first_word':
      return `Rewrite so it does NOT start with the word "${issue.text}". Start with a different strong action verb. Keep all facts and technologies exactly as they are.`;
    default:
      return 'Improve the wording. Keep all facts exactly as they are.';
  }
}

export default function ResumePreview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [resume, setResume] = useState<Resume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editingSummary, setEditingSummary] = useState<{ value: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // which action is running

  const load = useCallback(async () => {
    if (!sessionId) return;
    setResume(await api.sessions.getResume(sessionId));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      router.push('/jd-input');
      return;
    }
    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load resume'));
  }, [sessionId, load, router]);

  // Persist edited content as a new version; server responds with fresh lint.
  const save = async (updated: Resume) => {
    if (!sessionId) return;
    const { qualityReport: _drop, ...content } = updated;
    setResume(await api.sessions.saveResume(sessionId, content));
  };

  const withBusy = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const clone = (): Resume => JSON.parse(JSON.stringify(resume));

  const startEdit = (
    expIndex: number,
    bulletIndex: number,
    initial?: string,
    fromAI = false,
    aiVerified = true,
  ) => {
    if (!resume) return;
    setEditing({
      expIndex,
      bulletIndex,
      value: initial ?? resume.workExperience[expIndex].bullets[bulletIndex].text,
      fromAI,
      aiVerified,
    });
  };

  const commitEdit = () =>
    withBusy('edit', async () => {
      if (!editing || !resume) return;
      const next = clone();
      const b = next.workExperience[editing.expIndex].bullets[editing.bulletIndex];
      b.text = editing.value.trim();
      await save(next);
      setEditing(null);
    });

  const commitSummary = () =>
    withBusy('summary', async () => {
      if (!editingSummary || !resume) return;
      const next = clone();
      next.summary = editingSummary.value.trim();
      await save(next);
      setEditingSummary(null);
    });

  const revert = (expIndex: number, bulletIndex: number) =>
    withBusy(`revert-${expIndex}-${bulletIndex}`, async () => {
      if (!resume) return;
      const next = clone();
      const bullets = next.workExperience[expIndex].bullets;
      const b = bullets[bulletIndex];
      if (b.added) {
        bullets.splice(bulletIndex, 1); // brand-new bullet → remove entirely
      } else if (b.originalText) {
        b.text = b.originalText;
        delete b.originalText;
        b.provenance = 'profile_verified';
      }
      await save(next);
    });

  // Deterministic formatting fix: capitalize first letters and apply the
  // majority punctuation style to every bullet. No AI involved.
  const fixFormatting = () =>
    withBusy('formatting', async () => {
      if (!resume) return;
      const next = clone();
      const all = next.workExperience.flatMap((e) => e.bullets);
      const withPeriod = all.filter((b) => /[.!?]\s*$/.test(b.text)).length;
      const usePeriod = withPeriod * 2 >= all.length; // majority (tie → periods)
      for (const exp of next.workExperience) {
        for (const b of exp.bullets) {
          let t = b.text.trim();
          if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
          if (usePeriod && !/[.!?]$/.test(t)) t = `${t}.`;
          if (!usePeriod) t = t.replace(/\.+$/, '');
          b.text = t;
        }
      }
      await save(next);
    });

  // AI style fix: fetch a suggestion for the target bullet and open it in the
  // inline editor — saving the editor IS the approval. The request carries the
  // openers of every OTHER bullet so the rewrite can't create a new repeat,
  // and the server verifies the suggestion against the lint rules (with retry).
  const fixWithAI = (issue: QualityIssue, issueKey: string) =>
    withBusy(issueKey, async () => {
      if (!resume) return;
      const target =
        issue.expIndex !== undefined && issue.bulletIndex !== undefined
          ? { expIndex: issue.expIndex, bulletIndex: issue.bulletIndex }
          : issue.targets && issue.targets.length > 1
            ? issue.targets[1] // keep the first occurrence, fix the second
            : issue.targets?.[0];
      if (!target) return;
      const text = resume.workExperience[target.expIndex]?.bullets[target.bulletIndex]?.text;
      if (!text) return;

      // First words of every other bullet → forbidden openers for the rewrite.
      const avoidOpeners = Array.from(
        new Set(
          resume.workExperience.flatMap((e, ei) =>
            e.bullets
              .map((b, bi) => ({ ei, bi, w: (b.text.trim().split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '') }))
              .filter(({ ei, bi, w }) => w && !(ei === target.expIndex && bi === target.bulletIndex))
              .map(({ w }) => w),
          ),
        ),
      );

      if (!sessionId) return;
      const { text: suggestion, verified } = await api.sessions.fixBullet(sessionId, {
        text,
        instruction: fixInstruction(issue),
        avoid_openers: avoidOpeners,
      });
      startEdit(target.expIndex, target.bulletIndex, suggestion, true, verified !== false);
    });

  const downloadJson = () => {
    if (!resume) return;
    const blob = new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tailored-resume.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print-to-PDF: the @media print stylesheet strips everything except the
  // resume document. Temporarily set the tab title so the suggested PDF
  // filename is "<Name>-Resume".
  const exportPdf = () => {
    const prev = document.title;
    const name = String(resume?.header?.name || 'Resume').trim().replace(/\s+/g, '-');
    document.title = `${name}-Resume`;
    const restore = () => {
      document.title = prev;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  if (!sessionId) return null;
  if (error && !resume) {
    return (
      <div className="resume-preview">
        <div className="error-message">{error}</div>
        <Button variant="primary" onClick={() => { setError(null); load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load resume')); }}>
          Retry
        </Button>
      </div>
    );
  }
  if (!resume) {
    return (
      <div className="resume-preview resume-preview-loading">
        <Spinner text="Building your tailored resume..." />
      </div>
    );
  }

  const h = resume.header || {};
  const qr = resume.qualityReport;
  const hasFormattingIssues = qr?.issues.some((i) => FORMATTING.has(i.type));

  return (
    <div className="resume-preview">
      <div className="resume-toolbar">
        <h1>Your Tailored Resume</h1>
        <div className="resume-toolbar-actions">
          <Button variant="secondary" onClick={() => router.push(`/strategy-review?sessionId=${sessionId}`)}>
            Back
          </Button>
          <Button variant="secondary" onClick={downloadJson}>
            Download JSON
          </Button>
          <Button variant="primary" onClick={exportPdf}>
            Export PDF
          </Button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="resume-layout">
      <aside className="resume-side">
      {resume.changeLog?.length > 0 && (
        <div className="changelog">
          <h3>What we changed</h3>
          <ul>
            {resume.changeLog.map((c, i) => (
              <li key={i}>
                <strong>{c.skill}</strong> — {c.action} <span className="cl-where">@ {c.where}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {qr && (
        <div className={`final-check ${qr.passed ? 'final-check-pass' : 'final-check-warn'}`}>
          <h3>
            Final Check{' '}
            {qr.passed ? (
              <Badge variant="success">clean</Badge>
            ) : (
              <Badge variant="warning">{qr.issues.filter((i) => i.severity === 'warning').length} issue(s)</Badge>
            )}
            {hasFormattingIssues && (
              <button
                className="fc-fix-btn fc-fix-all"
                onClick={fixFormatting}
                disabled={busy !== null}
              >
                {busy === 'formatting' ? 'Fixing…' : '⚡ Fix formatting'}
              </button>
            )}
          </h3>
          {qr.issues.length === 0 ? (
            <p className="fc-clean">No style issues found — no buzzwords, repeated openers, or formatting inconsistencies.</p>
          ) : (
            <ul>
              {qr.issues.map((issue, i) => {
                const key = `fix-${i}`;
                return (
                  <li key={i} className={`fc-issue fc-${issue.severity}`}>
                    <span className="fc-type">{issue.type.replace(/_/g, ' ')}</span>
                    <span className="fc-msg">{issue.message}</span>
                    <span className="fc-where">@ {issue.where}</span>
                    {AI_FIXABLE.has(issue.type) &&
                      (issue.expIndex !== undefined || (issue.targets?.length ?? 0) > 0) && (
                        <button
                          className="fc-fix-btn"
                          onClick={() => fixWithAI(issue, key)}
                          disabled={busy !== null}
                        >
                          {busy === key ? 'Thinking…' : '✨ Fix with AI'}
                        </button>
                      )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      </aside>

      <div className="resume-main">
      <div className="resume-doc">
        <div className="resume-doc-header">
          <h2>{h.name || 'Your Name'}</h2>
          {h.title && <p className="resume-title">{h.title}</p>}
          <p className="resume-contact">
            {[h.address, h.phone, h.linkedin, h.url].filter(Boolean).join('  ·  ')}
          </p>
        </div>

        {(resume.summary || editingSummary) && (
          <section>
            <h3 className="resume-section-title">Summary</h3>
            {editingSummary ? (
              <div className="bullet-editor">
                <textarea
                  value={editingSummary.value}
                  onChange={(ev) => setEditingSummary({ value: ev.target.value })}
                  rows={3}
                  autoFocus
                />
                <div className="be-actions">
                  <button className="be-save" onClick={commitSummary} disabled={busy === 'summary'}>
                    {busy === 'summary' ? 'Saving…' : 'Save'}
                  </button>
                  <button className="be-cancel" onClick={() => setEditingSummary(null)} disabled={busy === 'summary'}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="resume-summary-text">
                {resume.summary}
                <span className="bullet-actions">
                  <button
                    className="ba-btn"
                    title="Edit summary"
                    onClick={() => setEditingSummary({ value: resume.summary || '' })}
                    disabled={busy !== null}
                  >
                    ✎
                  </button>
                </span>
              </p>
            )}
          </section>
        )}

        {resume.skills?.length > 0 && (
          <section>
            <h3 className="resume-section-title">Skills</h3>
            <p className="resume-skills">{resume.skills.join('  ·  ')}</p>
          </section>
        )}

        {resume.workExperience?.length > 0 && (
          <section>
            <h3 className="resume-section-title">Experience</h3>
            {resume.workExperience.map((e, ei) => (
              <div key={ei} className="resume-exp">
                <div className="resume-exp-head">
                  <strong>{e.company}</strong>
                  <span>{formatDateRange(e.startDate, e.endDate)}</span>
                </div>
                {e.position && <p className="resume-exp-pos">{e.position}</p>}
                <ul className="resume-bullets">
                  {e.bullets.map((b, bi) => {
                    const isEditing = editing?.expIndex === ei && editing?.bulletIndex === bi;
                    const tailored = b.provenance === 'user_confirmed';
                    return (
                      <li key={bi} className={tailored ? 'bullet-tailored' : ''}>
                        {isEditing ? (
                          <div className="bullet-editor">
                            {editing.fromAI && (
                              <span className={`be-ai-hint ${editing.aiVerified === false ? 'be-ai-unverified' : ''}`}>
                                {editing.aiVerified === false
                                  ? '⚠ AI suggestion could not fully satisfy all style rules — review extra carefully or rewrite yourself'
                                  : '✨ AI suggestion — review and save to approve'}
                              </span>
                            )}
                            <textarea
                              value={editing.value}
                              onChange={(ev) => setEditing({ ...editing, value: ev.target.value })}
                              rows={2}
                              autoFocus
                            />
                            <div className="be-actions">
                              <button className="be-save" onClick={commitEdit} disabled={busy === 'edit'}>
                                {busy === 'edit' ? 'Saving…' : 'Save'}
                              </button>
                              <button className="be-cancel" onClick={() => setEditing(null)} disabled={busy === 'edit'}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="bullet-text">{b.text}</span>
                            {tailored && (
                              <Badge variant="info" className="bullet-tag">
                                {b.added ? 'added' : 'tailored'}
                              </Badge>
                            )}
                            <span className="bullet-actions">
                              <button
                                className="ba-btn"
                                title="Edit this bullet"
                                onClick={() => startEdit(ei, bi)}
                                disabled={busy !== null}
                              >
                                ✎
                              </button>
                              {tailored && (b.originalText || b.added) && (
                                <button
                                  className="ba-btn"
                                  title={b.added ? 'Remove this added bullet' : 'Revert to your original wording'}
                                  onClick={() => revert(ei, bi)}
                                  disabled={busy !== null}
                                >
                                  ↩
                                </button>
                              )}
                            </span>
                            {tailored && b.originalText && (
                              <span className="bullet-before">before: {b.originalText}</span>
                            )}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        )}

        {resume.certifications?.length > 0 && (
          <section>
            <h3 className="resume-section-title">Certifications</h3>
            <ul className="resume-certs">
              {resume.certifications.map((c: any, i: number) => (
                <li key={i}>
                  {c.name}
                  {c.status ? ` (${c.status})` : ''}
                  {c.issuer ? ` — ${c.issuer}` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
