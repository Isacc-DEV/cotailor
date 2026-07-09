'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, Fragment, type ReactNode } from 'react';
import { Button, Spinner, Badge } from '@/app/components/ui';
import { formatDateRange } from '@/app/lib/date-format';
import { api } from '@/lib/api-client';
import { resolveStyleConfig, styleClasses, styleVars } from '@/lib/resume-style';
import { RESUME_SECTION_KEYS, type ResumeSectionKey, type StyleConfig } from '@cotailor/shared';
import PagedPreview from './PagedPreview';
import './page.css';
import './style-tokens.css';

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

interface AiChange {
  expIndex: number;
  bulletIndex: number;
  before: string;
}
interface SkippedIssue {
  type: string;
  text?: string;
  where: string;
}
// One "Fix all" run held for review: the full pre-run snapshot (Undo all),
// per-bullet befores (per-bullet undo), and what couldn't be fixed.
interface FixAllReview {
  before: Resume;
  changes: AiChange[];
  skipped: SkippedIssue[];
  formattingChanged: boolean;
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

const firstWordOf = (t: string) => (t.trim().split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');

// Render one education/certification entry as the single line the user sees and
// edits. Entries may be plain strings (user-edited) or the structured objects
// the generator produces.
function eduText(ed: any): string {
  if (typeof ed === 'string') return ed;
  if (!ed) return '';
  const head = [[ed.degree, ed.field].filter(Boolean).join(' in '), ed.institution].filter(Boolean).join(' — ');
  const when = ed.startDate || ed.graduationYear ? ` (${formatDateRange(ed.startDate, ed.graduationYear)})` : '';
  return head + when;
}
function certText(c: any): string {
  if (typeof c === 'string') return c;
  if (!c) return '';
  return `${c.name || ''}${c.status ? ` (${c.status})` : ''}${c.issuer ? ` — ${c.issuer}` : ''}`;
}

// Openers of every bullet except the target — forbidden for a rewrite so it
// can't create a new repeated-opener issue.
function otherOpeners(r: Resume, expIndex: number, bulletIndex: number): string[] {
  return Array.from(
    new Set(
      r.workExperience.flatMap((e, ei) =>
        e.bullets
          .map((b, bi) => ({ ei, bi, w: firstWordOf(b.text) }))
          .filter(({ ei: e2, bi: b2, w }) => w && !(e2 === expIndex && b2 === bulletIndex))
          .map(({ w }) => w),
      ),
    ),
  );
}

// During a batch run an earlier rewrite may have already cleared a later issue.
function stillApplies(issue: QualityIssue, text: string): boolean {
  if (issue.type === 'buzzword' || issue.type === 'weak_phrase') {
    return issue.text ? text.toLowerCase().includes(issue.text) : true;
  }
  if (issue.type === 'repeated_first_word') return firstWordOf(text) === issue.text;
  return true;
}

// Capitalize first letters and apply the majority punctuation style to every
// bullet. Deterministic — no AI involved. Mutates the given copy.
function applyFormattingFixes(next: Resume): void {
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
}

export default function ResumePreview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [resume, setResume] = useState<Resume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editingSummary, setEditingSummary] = useState<{ value: string } | null>(null);
  // Inline single-line editors for education / certification entries.
  const [editingEdu, setEditingEdu] = useState<{ index: number; value: string; added?: boolean } | null>(null);
  const [editingCert, setEditingCert] = useState<{ index: number; value: string; added?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // which action is running
  const [fixAllProgress, setFixAllProgress] = useState<{ done: number; total: number } | null>(null);
  const [review, setReview] = useState<FixAllReview | null>(null);
  const [styleCfg, setStyleCfg] = useState<StyleConfig | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  // Bullet drag-reorder (within a single job): which bullet is being dragged,
  // and where it would drop.
  const [drag, setDrag] = useState<{ expIndex: number; from: number; over: number; after: boolean } | null>(null);
  const resumeDocRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const [data, styles] = await Promise.all([
      api.sessions.getResume(sessionId),
      // Styles are cosmetic: if the list fails, render with the default look.
      api.styles.list().catch(() => []),
    ]);
    setResume(data);
    setStyleCfg(resolveStyleConfig(styles, data.styleKey));
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
      const bullets = next.workExperience[editing.expIndex].bullets;
      const text = editing.value.trim();
      if (text === '') {
        // There is no separate delete button — clearing a bullet's text and
        // saving removes the bullet entirely.
        bullets.splice(editing.bulletIndex, 1);
      } else {
        bullets[editing.bulletIndex].text = text;
      }
      await save(next);
      setEditing(null);
      setReview(null); // a manual edit ends the batch-fix review
    });

  const commitSummary = () =>
    withBusy('summary', async () => {
      if (!editingSummary || !resume) return;
      const next = clone();
      next.summary = editingSummary.value.trim();
      await save(next);
      setEditingSummary(null);
      setReview(null);
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
      setReview(null); // splicing shifts bullet indexes — the review's targets are stale
    });

  // Append a new empty bullet to a job and open it in the editor immediately.
  // The bullet lives in local state only until Save persists it; cancelling an
  // untouched new bullet removes it again (see cancelEdit).
  const addBullet = (expIndex: number) => {
    if (!resume || busy !== null) return;
    const next = clone();
    const bullets = next.workExperience[expIndex].bullets;
    bullets.push({ text: '', provenance: 'user_confirmed', added: true });
    setResume(next);
    startEdit(expIndex, bullets.length - 1, '');
  };

  // Commit a within-job bullet move: pull the bullet out and reinsert it at the
  // computed target slot, then persist. Reordering shifts indexes, so any
  // pending batch-fix review is dropped.
  const moveBullet = (expIndex: number, from: number, to: number) =>
    withBusy('reorder', async () => {
      if (!resume || from === to) return;
      const next = clone();
      const bullets = next.workExperience[expIndex].bullets;
      if (from < 0 || from >= bullets.length || to < 0 || to >= bullets.length) return;
      const [moved] = bullets.splice(from, 1);
      bullets.splice(to, 0, moved);
      await save(next);
      setReview(null);
    });

  // Translate a drop (onto `over`, above or below its midpoint) into a target
  // index, correcting for the gap left when the dragged bullet is removed.
  const dropBullet = () => {
    if (!drag) return;
    const { expIndex, from, over, after } = drag;
    let to = over + (after ? 1 : 0);
    if (from < to) to -= 1;
    setDrag(null);
    if (to !== from) moveBullet(expIndex, from, to);
  };

  // Cancel the inline editor. A brand-new, never-saved bullet that was left
  // empty is discarded so cancelling "add bullet" leaves no blank behind.
  const cancelEdit = () => {
    if (editing && resume) {
      const b = resume.workExperience[editing.expIndex]?.bullets[editing.bulletIndex];
      if (b?.added && !b.text) {
        const next = clone();
        next.workExperience[editing.expIndex].bullets.splice(editing.bulletIndex, 1);
        setResume(next);
      }
    }
    setEditing(null);
  };

  // --- Education entries (stored as plain strings once user-edited) ---
  const startEditEdu = (index: number) => {
    if (!resume) return;
    setEditingEdu({ index, value: eduText(resume.education[index]) });
  };
  const addEdu = () => {
    if (!resume || busy !== null) return;
    const next = clone();
    if (!Array.isArray(next.education)) next.education = [];
    next.education.push('');
    setResume(next);
    setEditingEdu({ index: next.education.length - 1, value: '', added: true });
  };
  const commitEdu = () =>
    withBusy('edu', async () => {
      if (!editingEdu || !resume) return;
      const next = clone();
      const text = editingEdu.value.trim();
      if (text === '') next.education.splice(editingEdu.index, 1); // cleared → delete
      else next.education[editingEdu.index] = text;
      await save(next);
      setEditingEdu(null);
    });
  const cancelEdu = () => {
    if (editingEdu?.added && resume) {
      const next = clone();
      next.education.splice(editingEdu.index, 1); // discard the never-saved new entry
      setResume(next);
    }
    setEditingEdu(null);
  };

  // --- Certification entries (stored as { name } once user-edited) ---
  const startEditCert = (index: number) => {
    if (!resume) return;
    setEditingCert({ index, value: certText(resume.certifications[index]) });
  };
  const addCert = () => {
    if (!resume || busy !== null) return;
    const next = clone();
    if (!Array.isArray(next.certifications)) next.certifications = [];
    next.certifications.push({ name: '' });
    setResume(next);
    setEditingCert({ index: next.certifications.length - 1, value: '', added: true });
  };
  const commitCert = () =>
    withBusy('cert', async () => {
      if (!editingCert || !resume) return;
      const next = clone();
      const text = editingCert.value.trim();
      if (text === '') next.certifications.splice(editingCert.index, 1); // cleared → delete
      else next.certifications[editingCert.index] = { name: text };
      await save(next);
      setEditingCert(null);
    });
  const cancelCert = () => {
    if (editingCert?.added && resume) {
      const next = clone();
      next.certifications.splice(editingCert.index, 1); // discard the never-saved new entry
      setResume(next);
    }
    setEditingCert(null);
  };

  const fixFormatting = () =>
    withBusy('formatting', async () => {
      if (!resume) return;
      const next = clone();
      applyFormattingFixes(next);
      await save(next);
      setReview(null);
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

      if (!sessionId) return;
      const { text: suggestion, verified } = await api.sessions.fixBullet(sessionId, {
        text,
        instruction: fixInstruction(issue),
        avoid_openers: otherOpeners(resume, target.expIndex, target.bulletIndex),
      });
      startEdit(target.expIndex, target.bulletIndex, suggestion, true, verified !== false);
    });

  // One-click batch fix: deterministic formatting plus every AI-fixable issue.
  // Rewrites run SEQUENTIALLY — each accepted rewrite's opener feeds into the
  // next call's avoid_openers, so the batch can't reintroduce repeated openers.
  // Nothing persists until the single save at the end; the review bar then
  // offers Keep all / Undo all, and unverified rewrites are never applied.
  const fixAllWithAI = () =>
    withBusy('fix-all', async () => {
      if (!resume || !sessionId || !resume.qualityReport) return;
      const beforeSnapshot = clone();
      const next = clone();

      const jobs: Array<{ expIndex: number; bulletIndex: number; issue: QualityIssue }> = [];
      for (const issue of resume.qualityReport.issues) {
        if (!AI_FIXABLE.has(issue.type)) continue;
        if (issue.expIndex !== undefined && issue.bulletIndex !== undefined) {
          jobs.push({ expIndex: issue.expIndex, bulletIndex: issue.bulletIndex, issue });
        } else if (issue.targets && issue.targets.length > 1) {
          for (const t of issue.targets.slice(1)) jobs.push({ ...t, issue }); // keep the first occurrence
        }
      }
      const hadFormattingIssues = resume.qualityReport.issues.some((i) => FORMATTING.has(i.type));
      if (jobs.length === 0 && !hadFormattingIssues) return;

      setFixAllProgress({ done: 0, total: jobs.length });
      const changes = new Map<string, AiChange>();
      const skipped: SkippedIssue[] = [];
      try {
        for (let i = 0; i < jobs.length; i++) {
          const { expIndex, bulletIndex, issue } = jobs[i];
          setFixAllProgress({ done: i, total: jobs.length });
          const bullet = next.workExperience[expIndex]?.bullets[bulletIndex];
          if (!bullet || !stillApplies(issue, bullet.text)) continue;
          const { text: suggestion, verified } = await api.sessions.fixBullet(sessionId, {
            text: bullet.text,
            instruction: fixInstruction(issue),
            avoid_openers: otherOpeners(next, expIndex, bulletIndex),
          });
          if (verified === false || !suggestion?.trim()) {
            skipped.push({ type: issue.type, text: issue.text, where: issue.where });
            continue;
          }
          const key = `${expIndex}:${bulletIndex}`;
          if (!changes.has(key)) {
            changes.set(key, {
              expIndex,
              bulletIndex,
              before: beforeSnapshot.workExperience[expIndex].bullets[bulletIndex].text,
            });
          }
          bullet.text = suggestion.trim();
        }
        setFixAllProgress({ done: jobs.length, total: jobs.length });

        // Formatting runs LAST so AI rewrites get normalized too.
        if (hadFormattingIssues || changes.size > 0) {
          applyFormattingFixes(next);
          await save(next);
        }
        setReview(
          changes.size > 0 || skipped.length > 0 || hadFormattingIssues
            ? { before: beforeSnapshot, changes: [...changes.values()], skipped, formattingChanged: hadFormattingIssues }
            : null,
        );
      } finally {
        setFixAllProgress(null);
      }
    });

  const undoAiFix = (expIndex: number, bulletIndex: number) =>
    withBusy(`undo-ai-${expIndex}-${bulletIndex}`, async () => {
      if (!review || !resume) return;
      const change = review.changes.find((c) => c.expIndex === expIndex && c.bulletIndex === bulletIndex);
      if (!change) return;
      const next = clone();
      const b = next.workExperience[expIndex]?.bullets[bulletIndex];
      if (b) {
        b.text = change.before;
        await save(next);
      }
      const remaining = review.changes.filter((c) => c !== change);
      setReview(
        remaining.length > 0 || review.skipped.length > 0 || review.formattingChanged
          ? { ...review, changes: remaining }
          : null,
      );
    });

  const undoAll = () =>
    withBusy('undo-all', async () => {
      if (!review) return;
      await save(review.before);
      setReview(null);
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
  // Everything the one-click button will address: formatting issues plus
  // AI-fixable issues that are anchored to a bullet.
  const fixAllCount = qr
    ? qr.issues.filter(
        (i) =>
          FORMATTING.has(i.type) ||
          (AI_FIXABLE.has(i.type) && (i.expIndex !== undefined || (i.targets?.length ?? 0) > 0)),
      ).length
    : 0;
  const reviewSummary = review
    ? [
        review.changes.length > 0
          ? `${review.changes.length} bullet${review.changes.length === 1 ? '' : 's'} rewritten`
          : '',
        review.formattingChanged ? 'formatting cleaned up' : '',
      ]
        .filter(Boolean)
        .join(' · ') || 'No fixes could be applied automatically'
    : '';

  // One inline-editable list row (shared by Education & Certifications): shows
  // the text with an edit pencil, or the textarea editor when active. Clearing
  // the text and saving deletes the row (handled by the commit fns).
  const renderEntryLi = (
    index: number,
    text: string,
    isEditing: boolean,
    value: string,
    setValue: (v: string) => void,
    onSave: () => void,
    onCancel: () => void,
    onEdit: () => void,
    busyKey: string,
  ) => (
    <li key={index}>
      {isEditing ? (
        <div className="bullet-editor">
          <textarea value={value} onChange={(ev) => setValue(ev.target.value)} rows={2} autoFocus />
          <div className="be-actions">
            <button className="be-save" onClick={onSave} disabled={busy === busyKey}>
              {busy === busyKey ? 'Saving…' : 'Save'}
            </button>
            <button className="be-cancel" onClick={onCancel} disabled={busy === busyKey}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <span className="bullet-text">{text}</span>
          <span className="bullet-actions">
            <button className="ba-btn" title="Edit" onClick={onEdit} disabled={busy !== null}>
              ✎
            </button>
          </span>
        </>
      )}
    </li>
  );

  const addEntryBtn = (onClick: () => void, label: string) => (
    <button className="add-bullet-btn" onClick={onClick} disabled={busy !== null} title={label} aria-label={label}>
      <span className="ab-plus">+</span>
      <span className="ab-line" />
    </button>
  );

  // The document's sections, keyed so the style's sectionOrder can arrange
  // them. Real DOM order (not CSS order) so print pagination and the text
  // order ATS parsers extract from the exported PDF match what the eye sees.
  const sectionNodes: Record<ResumeSectionKey, ReactNode> = {
    summary:
      resume.summary || editingSummary ? (
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
      ) : null,
    skills:
      resume.skills?.length > 0 ? (
        <section>
          <h3 className="resume-section-title">Skills</h3>
          {styleCfg?.skillsLayout === 'pills' ? (
            <p className="resume-skills resume-skills-pills">
              {resume.skills.map((s, i) => (
                <span key={i} className="skill-pill">
                  {s}
                </span>
              ))}
            </p>
          ) : (
            <p className="resume-skills">{resume.skills.join('  ·  ')}</p>
          )}
        </section>
      ) : null,
    experience:
      resume.workExperience?.length > 0 ? (
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
                  const aiFix = review?.changes.find((c) => c.expIndex === ei && c.bulletIndex === bi);
                  return (
                    <li
                      key={bi}
                      className={[
                        tailored ? 'bullet-tailored' : '',
                        aiFix ? 'bullet-ai-fixed' : '',
                        drag && drag.expIndex === ei && drag.from === bi ? 'bullet-dragging' : '',
                        drag && drag.expIndex === ei && drag.over === bi && drag.from !== bi
                          ? drag.after
                            ? 'drop-after'
                            : 'drop-before'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      draggable={!isEditing && busy === null}
                      onDragStart={(e) => {
                        setDrag({ expIndex: ei, from: bi, over: bi, after: false });
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(bi)); // Firefox needs payload
                      }}
                      onDragOver={(e) => {
                        if (!drag || drag.expIndex !== ei) return; // same job only
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const rect = e.currentTarget.getBoundingClientRect();
                        const after = e.clientY > rect.top + rect.height / 2;
                        if (drag.over !== bi || drag.after !== after) setDrag({ ...drag, over: bi, after });
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        dropBullet();
                      }}
                      onDragEnd={() => setDrag(null)}
                    >
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
                            <button className="be-cancel" onClick={cancelEdit} disabled={busy === 'edit'}>
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
                            {aiFix && (
                              <button
                                className="ba-btn"
                                title="Undo this AI rewrite"
                                onClick={() => undoAiFix(ei, bi)}
                                disabled={busy !== null}
                              >
                                ↩
                              </button>
                            )}
                            {!aiFix && tailored && (b.originalText || b.added) && (
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
                          {aiFix && <span className="bullet-before">✨ before: {aiFix.before}</span>}
                          {tailored && b.originalText && (
                            <span className="bullet-before">before: {b.originalText}</span>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
              <button
                className="add-bullet-btn"
                onClick={() => addBullet(ei)}
                disabled={busy !== null}
                title="Add a bullet"
                aria-label="Add a bullet"
              >
                <span className="ab-plus">+</span>
                <span className="ab-line" />
              </button>
            </div>
          ))}
        </section>
      ) : null,
    education: (
      <section>
        <h3 className="resume-section-title">Education</h3>
        <ul className="resume-edu">
          {(resume.education ?? []).map((ed: any, i: number) =>
            renderEntryLi(
              i,
              eduText(ed),
              editingEdu?.index === i,
              editingEdu?.value ?? '',
              (v) => setEditingEdu((s) => (s ? { ...s, value: v } : s)),
              commitEdu,
              cancelEdu,
              () => startEditEdu(i),
              'edu',
            ),
          )}
        </ul>
        {addEntryBtn(addEdu, 'Add education')}
      </section>
    ),
    certifications: (
      <section>
        <h3 className="resume-section-title">Certifications</h3>
        <ul className="resume-certs">
          {(resume.certifications ?? []).map((c: any, i: number) =>
            renderEntryLi(
              i,
              certText(c),
              editingCert?.index === i,
              editingCert?.value ?? '',
              (v) => setEditingCert((s) => (s ? { ...s, value: v } : s)),
              commitCert,
              cancelCert,
              () => startEditCert(i),
              'cert',
            ),
          )}
        </ul>
        {addEntryBtn(addCert, 'Add certification')}
      </section>
    ),
  };
  const sectionOrder: ResumeSectionKey[] = styleCfg?.sectionOrder ?? [...RESUME_SECTION_KEYS];

  return (
    <div className="resume-preview">
      <div className="resume-toolbar">
        <h1>Your Tailored Resume</h1>
        <div className="resume-toolbar-actions">
          <Button
            variant="secondary"
            className="resume-toolbar-btn"
            onClick={() => router.push(`/strategy-review?sessionId=${sessionId}`)}
          >
            Back
          </Button>
          <Button variant="secondary" className="resume-toolbar-btn" onClick={downloadJson}>
            Download JSON
          </Button>
          <Button variant="primary" className="resume-toolbar-btn primary" onClick={() => setShowPreview(true)}>
            Preview / Export
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
          </h3>
          {fixAllProgress ? (
            <div className="fc-progress" role="status" aria-live="polite">
              ✨{' '}
              {fixAllProgress.total > 0
                ? `Rewriting bullet ${Math.min(fixAllProgress.done + 1, fixAllProgress.total)} of ${fixAllProgress.total}…`
                : 'Fixing formatting…'}
              <div className="fc-progress-track">
                <div
                  className="fc-progress-fill"
                  style={{
                    width: `${fixAllProgress.total ? Math.round((fixAllProgress.done / fixAllProgress.total) * 100) : 100}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            fixAllCount > 0 && (
              <div className="fc-actions">
                <button className="fc-fix-btn fc-fix-all" onClick={fixAllWithAI} disabled={busy !== null}>
                  {busy === 'fix-all' ? 'Fixing…' : `✨ Fix all (${fixAllCount})`}
                </button>
                {hasFormattingIssues && (
                  <button className="fc-fix-btn" onClick={fixFormatting} disabled={busy !== null}>
                    {busy === 'formatting' ? 'Fixing…' : '⚡ Formatting only'}
                  </button>
                )}
              </div>
            )
          )}
          {qr.issues.length === 0 ? (
            <p className="fc-clean">No style issues found — no buzzwords, repeated openers, or formatting inconsistencies.</p>
          ) : (
            <ul>
              {qr.issues.map((issue, i) => {
                const key = `fix-${i}`;
                const needsManual = review?.skipped.some(
                  (s) => s.type === issue.type && s.text === issue.text && s.where === issue.where,
                );
                return (
                  <li key={i} className={`fc-issue fc-${issue.severity}`}>
                    <span className="fc-type">{issue.type.replace(/_/g, ' ')}</span>
                    <span className="fc-msg">{issue.message}</span>
                    <span className="fc-where">@ {issue.where}</span>
                    {needsManual && <span className="fc-manual">⚠ fix by hand</span>}
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
      <div
        ref={resumeDocRef}
        className={`resume-doc${styleCfg ? ` ${styleClasses(styleCfg)}` : ''}`}
        style={styleCfg ? styleVars(styleCfg) : undefined}
      >
        <div className="resume-doc-header">
          <h2>{h.name || 'Your Name'}</h2>
          {h.title && <p className="resume-title">{h.title}</p>}
          <p className="resume-contact">
            {[h.address, h.email, h.phone, h.linkedin, h.url].filter(Boolean).join('  ·  ')}
          </p>
        </div>

        {sectionOrder.map((k) => (
          <Fragment key={k}>{sectionNodes[k]}</Fragment>
        ))}
      </div>
      </div>
      </div>

      {review && (
        <div className="fixall-review-bar" role="status">
          <span className="frb-msg">
            ✨ {reviewSummary}
            {review.changes.length > 0 ? ' — changes are highlighted.' : '.'}
            {review.skipped.length > 0 && (
              <span className="frb-warn">
                {' '}
                {review.skipped.length} issue{review.skipped.length === 1 ? '' : 's'} need
                {review.skipped.length === 1 ? 's' : ''} a manual edit.
              </span>
            )}
          </span>
          <span className="frb-actions">
            {(review.changes.length > 0 || review.formattingChanged) && (
              <Button variant="secondary" onClick={undoAll} disabled={busy !== null}>
                {busy === 'undo-all' ? 'Undoing…' : 'Undo all'}
              </Button>
            )}
            <Button variant="primary" onClick={() => setReview(null)} disabled={busy !== null}>
              Keep all
            </Button>
          </span>
        </div>
      )}

      {showPreview && (
        <PagedPreview resume={resume} styleCfg={styleCfg} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}
