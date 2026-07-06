// Canonical vocabulary for CoTailor. These strings are the single source of truth
// shared across api + web. See the design document, Section 0.3.

export const SESSION_STATES = [
  'CREATED',
  'JD_SUBMITTED',
  'ANALYZING',
  'CATEGORY_REJECTED',
  'WAITING_CATEGORY_CONFIRMATION',
  'WAITING_SUBTYPE_CONFIRMATION',
  'WAITING_SKILL_DECISIONS',
  'STRATEGY_REVIEW',
  'GENERATING',
  'VALIDATING',
  'NEEDS_REVISION',
  'FINAL_READY',
  'REVISING',
  'CANCELLED',
  'EXPIRED',
] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export const TERMINAL_STATES: readonly SessionState[] = [
  'CATEGORY_REJECTED',
  'CANCELLED',
  'EXPIRED',
];

export const CARD_TYPES = [
  'category_mismatch',
  'category_low_confidence',
  'subtype_mismatch',
  'missing_required_skill',
  'similar_skill',
  'certification_risk',
  'resume_style',
  'strategy_approval',
] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const CARD_SEVERITIES = ['info', 'warning', 'blocking', 'critical'] as const;
export type CardSeverity = (typeof CARD_SEVERITIES)[number];

export const CARD_STATUSES = ['pending', 'answered', 'auto_resolved', 'expired'] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const MATCH_TYPES = [
  'exact',
  'equivalent',
  'similar_stack',
  'same_family',
  'missing',
  'blocked_sensitive',
] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const RISK_LEVELS = ['none', 'low', 'medium', 'high', 'critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

// Provenance: three values (the `reframed` value was retired — see design v3).
export const PROVENANCE = ['profile_verified', 'user_confirmed', 'omitted'] as const;
export type Provenance = (typeof PROVENANCE)[number];

// Skill-card options depend on the case (Section 7 / 10.7):
//   Case 1 (similar_stack/same_family): replace | update | skills_only
//   Case 2 (missing + related evidence): update | skills_only
//   Case 3 (missing, no anchor):         add_bullet | skills_only
//   sensitive (cert/license/clearance):  have_it | dont_add
export const SKILL_OPTIONS = [
  'replace',
  'update',
  'skills_only',
  'add_bullet',
  'have_it',
  'dont_add',
] as const;
export type SkillOption = (typeof SKILL_OPTIONS)[number];

export const BULLET_ACTIONS = [
  'emphasize_existing',
  'replace',
  'update',
  'add_bullet',
  'skills_only',
  'none',
] as const;
export type BulletAction = (typeof BULLET_ACTIONS)[number];

export const RESUME_STYLES = ['ats_strong', 'recruiter_friendly', 'balanced'] as const;
export type ResumeStyle = (typeof RESUME_STYLES)[number];
export const DEFAULT_RESUME_STYLE: ResumeStyle = 'balanced';

export const SKILL_PRIORITIES = ['required', 'preferred'] as const;
export type SkillPriority = (typeof SKILL_PRIORITIES)[number];

export const SUBTYPE_RELATIONS = ['same', 'subsumes', 'overlaps', 'sibling', 'unrelated'] as const;
export type SubtypeRelation = (typeof SUBTYPE_RELATIONS)[number];

export const CATEGORY_RELATIONS = ['same', 'adjacent', 'distinct'] as const;
export type CategoryRelation = (typeof CATEGORY_RELATIONS)[number];


export const SCREENING_OUTLOOKS = ['likely_pass', 'borderline', 'unlikely'] as const;
export type ScreeningOutlook = (typeof SCREENING_OUTLOOKS)[number];

// Coverage credit per handling (Section 13).
export const COVERAGE_CREDIT = {
  demonstrated: 1.0, // exact / equivalent / replace / update / add_bullet
  skills_only: 0.6, // listed in Skills, not demonstrated in a bullet
  omitted: 0.0,
} as const;

// Category confidence band threshold (Section 8).
export const CATEGORY_CONFIDENCE_THRESHOLD = 0.8;
// Decision Board fatigue ceiling (Section 7.5).
export const CARD_BUDGET = 7;
// JD intake cap (Section 9 / 20).
export const JD_CHAR_CAP = 15000;
