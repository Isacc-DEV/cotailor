// Deterministic resume "final check" linter (no LLM, runs on every build).
// Catches the classic resume-quality problems: buzzwords/clichés, repeated
// bullet openers, and inconsistent writing style. Pure functions — unit-testable.

export interface QualityIssue {
  type:
    | 'buzzword'
    | 'weak_phrase'
    | 'repeated_first_word'
    | 'punctuation_inconsistent'
    | 'capitalization'
    | 'long_bullet'
    | 'short_bullet';
  severity: 'info' | 'warning';
  where: string; // e.g. "TechCorp — bullet 2" or "resume-wide"
  text?: string; // offending snippet
  message: string;
  /** Bullet the issue is anchored to (per-bullet issues). */
  expIndex?: number;
  bulletIndex?: number;
  /** All affected bullets (repeated_first_word) — fix targets[1..], keep the first. */
  targets?: Array<{ expIndex: number; bulletIndex: number }>;
}

export interface QualityReport {
  issues: QualityIssue[];
  passed: boolean; // no warnings (info-only still passes)
}

// Clichés and filler that weaken a resume. Matched case-insensitively as phrases.
export const BUZZWORDS = [
  'results-driven',
  'results-oriented',
  'team player',
  'go-getter',
  'self-starter',
  'detail-oriented',
  'hard-working',
  'hardworking',
  'dynamic',
  'passionate',
  'proactive',
  'motivated',
  'synergy',
  'synergize',
  'think outside the box',
  'go above and beyond',
  'best-in-class',
  'world-class',
  'cutting-edge',
  'state-of-the-art',
  'seamlessly',
  'proven track record',
];

// Weak openers that hide the action ("responsible for managing" → "Managed").
export const WEAK_PHRASES = [
  'responsible for',
  'duties included',
  'worked on',
  'helped with',
  'assisted with',
  'tasked with',
  'utilized',
  'in charge of',
];

interface LintableExperience {
  company: string;
  bullets: Array<{ text: string }>;
}

export function lintResume(workExperience: LintableExperience[], summary?: string): QualityReport {
  const issues: QualityIssue[] = [];

  // Summaries are the most cliché-prone part of a resume — same word rules apply.
  if (summary) {
    const lower = summary.toLowerCase();
    for (const bad of BUZZWORDS) {
      if (lower.includes(bad)) {
        issues.push({
          type: 'buzzword',
          severity: 'warning',
          where: 'Summary',
          text: bad,
          message: `"${bad}" is a resume cliché — replace it with a concrete fact.`,
        });
      }
    }
    for (const weak of WEAK_PHRASES) {
      if (lower.includes(weak)) {
        issues.push({
          type: 'weak_phrase',
          severity: 'warning',
          where: 'Summary',
          text: weak,
          message: `"${weak}" is a weak phrase — state the accomplishment directly.`,
        });
      }
    }
  }

  const allBullets: Array<{ text: string; where: string; expIndex: number; bulletIndex: number }> = [];
  workExperience.forEach((exp, ei) => {
    exp.bullets.forEach((b, bi) => {
      allBullets.push({ text: b.text, where: `${exp.company} — bullet ${bi + 1}`, expIndex: ei, bulletIndex: bi });
    });
  });

  // --- Buzzwords & weak phrases ---
  for (const { text, where, expIndex, bulletIndex } of allBullets) {
    const lower = text.toLowerCase();
    for (const bad of BUZZWORDS) {
      if (lower.includes(bad)) {
        issues.push({
          type: 'buzzword',
          severity: 'warning',
          where,
          text: bad,
          expIndex,
          bulletIndex,
          message: `"${bad}" is a resume cliché — replace it with a concrete fact or metric.`,
        });
      }
    }
    for (const weak of WEAK_PHRASES) {
      if (lower.includes(weak)) {
        issues.push({
          type: 'weak_phrase',
          severity: 'warning',
          where,
          text: weak,
          expIndex,
          bulletIndex,
          message: `"${weak}" is a weak phrase — lead with a strong action verb instead.`,
        });
      }
    }
  }

  // --- Repeated first words (per job: 2+, resume-wide: 3+) ---
  const firstWord = (t: string) => (t.trim().split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
  workExperience.forEach((exp, ei) => {
    const byWord = new Map<string, number[]>();
    exp.bullets.forEach((b, bi) => {
      const w = firstWord(b.text);
      if (w) byWord.set(w, [...(byWord.get(w) ?? []), bi]);
    });
    for (const [w, bulletIdxs] of byWord) {
      if (bulletIdxs.length >= 2) {
        issues.push({
          type: 'repeated_first_word',
          severity: 'warning',
          where: exp.company,
          text: w,
          targets: bulletIdxs.map((bi) => ({ expIndex: ei, bulletIndex: bi })),
          message: `${bulletIdxs.length} bullets at ${exp.company} start with "${capitalize(w)}" — vary your action verbs.`,
        });
      }
    }
  });
  const globalByWord = new Map<string, Array<{ expIndex: number; bulletIndex: number }>>();
  for (const { text, expIndex, bulletIndex } of allBullets) {
    const w = firstWord(text);
    if (w) globalByWord.set(w, [...(globalByWord.get(w) ?? []), { expIndex, bulletIndex }]);
  }
  for (const [w, targets] of globalByWord) {
    if (targets.length >= 3) {
      const alreadyPerJob = issues.some((i) => i.type === 'repeated_first_word' && i.text === w);
      if (!alreadyPerJob) {
        issues.push({
          type: 'repeated_first_word',
          severity: 'warning',
          where: 'resume-wide',
          text: w,
          targets,
          message: `${targets.length} bullets across the resume start with "${capitalize(w)}" — vary your action verbs.`,
        });
      }
    }
  }

  // --- Terminal punctuation consistency (resume-wide) ---
  const withPeriod = allBullets.filter((b) => /[.!?]\s*$/.test(b.text)).length;
  const withoutPeriod = allBullets.length - withPeriod;
  if (withPeriod > 0 && withoutPeriod > 0) {
    issues.push({
      type: 'punctuation_inconsistent',
      severity: 'warning',
      where: 'resume-wide',
      message: `${withPeriod} bullet(s) end with a period and ${withoutPeriod} don't — pick one style for all bullets.`,
    });
  }

  // --- Capitalization & length ---
  for (const { text, where, expIndex, bulletIndex } of allBullets) {
    const trimmed = text.trim();
    if (trimmed && /^[a-z]/.test(trimmed)) {
      issues.push({
        type: 'capitalization',
        severity: 'warning',
        where,
        text: trimmed.slice(0, 40),
        expIndex,
        bulletIndex,
        message: 'Bullet starts with a lowercase letter.',
      });
    }
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    if (words > 32) {
      issues.push({
        type: 'long_bullet',
        severity: 'info',
        where,
        text: trimmed.slice(0, 60) + '…',
        expIndex,
        bulletIndex,
        message: `Bullet is ${words} words — consider splitting or tightening (aim for under ~30).`,
      });
    } else if (words > 0 && words < 4) {
      issues.push({
        type: 'short_bullet',
        severity: 'info',
        where,
        text: trimmed,
        expIndex,
        bulletIndex,
        message: 'Bullet is very short — add what you did and the outcome.',
      });
    }
  }

  return {
    issues,
    passed: !issues.some((i) => i.severity === 'warning'),
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
