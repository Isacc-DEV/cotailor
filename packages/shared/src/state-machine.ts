// Backend-owned session state machine (design Section 19).
// The LLM never drives transitions — only these events, triggered by user
// actions or worker completions, move a session between states.

import type { SessionState } from './enums';

export const SESSION_EVENTS = [
  'SUBMIT_JD',
  'START_ANALYSIS',
  'ANALYSIS_CATEGORY_REJECTED',
  'ANALYSIS_CATEGORY_LOW_CONF',
  'ANALYSIS_SUBTYPE_MISMATCH',
  'ANALYSIS_NEEDS_CARDS',
  'ANALYSIS_CLEAN', // zero cards → straight to strategy
  'CONFIRM_CATEGORY', // re-evaluates the gate
  'CANCEL_CATEGORY',
  'SUBTYPE_YES',
  'SUBTYPE_NO',
  'CARDS_RESOLVED', // last board card answered → strategy job enqueued
  'STRATEGY_READY',
  'ADJUST_DECISIONS', // reopen the board from strategy review
  'APPROVE_STRATEGY', // the generation trigger
  'GENERATION_READY',
  'VALIDATION_PASSED',
  'VALIDATION_FAILED_RETRY',
  'VALIDATION_FAILED_FINAL',
  'REVISION_REQUESTED',
  'REVISION_READY',
  'CANCEL',
  'EXPIRE',
] as const;
export type SessionEvent = (typeof SESSION_EVENTS)[number];

// (state, event) -> next state. Missing entries are illegal transitions.
export const TRANSITIONS: Record<SessionState, Partial<Record<SessionEvent, SessionState>>> = {
  CREATED: { SUBMIT_JD: 'JD_SUBMITTED', CANCEL: 'CANCELLED', EXPIRE: 'EXPIRED' },
  JD_SUBMITTED: { START_ANALYSIS: 'ANALYZING', CANCEL: 'CANCELLED', EXPIRE: 'EXPIRED' },
  ANALYZING: {
    ANALYSIS_CATEGORY_REJECTED: 'CATEGORY_REJECTED',
    ANALYSIS_CATEGORY_LOW_CONF: 'WAITING_CATEGORY_CONFIRMATION',
    ANALYSIS_SUBTYPE_MISMATCH: 'WAITING_SUBTYPE_CONFIRMATION',
    ANALYSIS_NEEDS_CARDS: 'WAITING_SKILL_DECISIONS',
    ANALYSIS_CLEAN: 'STRATEGY_REVIEW',
    CANCEL: 'CANCELLED',
    EXPIRE: 'EXPIRED',
  },
  WAITING_CATEGORY_CONFIRMATION: {
    // CONFIRM_CATEGORY re-evaluates the gate; the worker then emits one of the
    // ANALYSIS_* events above. Modelled here as a return to ANALYZING.
    CONFIRM_CATEGORY: 'ANALYZING',
    CANCEL_CATEGORY: 'CANCELLED',
    CANCEL: 'CANCELLED',
    EXPIRE: 'EXPIRED',
  },
  WAITING_SUBTYPE_CONFIRMATION: {
    SUBTYPE_YES: 'WAITING_SKILL_DECISIONS',
    SUBTYPE_NO: 'CANCELLED',
    CANCEL: 'CANCELLED',
    EXPIRE: 'EXPIRED',
  },
  WAITING_SKILL_DECISIONS: {
    CARDS_RESOLVED: 'WAITING_SKILL_DECISIONS', // strategy job runs; state holds
    STRATEGY_READY: 'STRATEGY_REVIEW',
    CANCEL: 'CANCELLED',
    EXPIRE: 'EXPIRED',
  },
  STRATEGY_REVIEW: {
    APPROVE_STRATEGY: 'GENERATING',
    ADJUST_DECISIONS: 'WAITING_SKILL_DECISIONS',
    CANCEL: 'CANCELLED',
    EXPIRE: 'EXPIRED',
  },
  GENERATING: { GENERATION_READY: 'VALIDATING', CANCEL: 'CANCELLED', EXPIRE: 'EXPIRED' },
  VALIDATING: {
    VALIDATION_PASSED: 'FINAL_READY',
    VALIDATION_FAILED_RETRY: 'NEEDS_REVISION',
    VALIDATION_FAILED_FINAL: 'FINAL_READY',
    CANCEL: 'CANCELLED',
    EXPIRE: 'EXPIRED',
  },
  NEEDS_REVISION: { GENERATION_READY: 'VALIDATING', CANCEL: 'CANCELLED', EXPIRE: 'EXPIRED' },
  FINAL_READY: { REVISION_REQUESTED: 'REVISING', EXPIRE: 'EXPIRED' },
  REVISING: { REVISION_READY: 'VALIDATING', CANCEL: 'CANCELLED', EXPIRE: 'EXPIRED' },
  CATEGORY_REJECTED: {},
  CANCELLED: {},
  EXPIRED: {},
};

// Human/endpoint hint per event, for the 409 `allowed_actions` payload.
export const EVENT_ACTIONS: Partial<Record<SessionEvent, string>> = {
  SUBMIT_JD: 'POST /api/v1/sessions/{id}/jd',
  CONFIRM_CATEGORY: 'POST /api/v1/sessions/{id}/cards/{card_id}/answer',
  SUBTYPE_YES: 'POST /api/v1/sessions/{id}/cards/{card_id}/answer',
  SUBTYPE_NO: 'POST /api/v1/sessions/{id}/cards/{card_id}/answer',
  CARDS_RESOLVED: 'POST /api/v1/sessions/{id}/cards/{card_id}/answer',
  APPROVE_STRATEGY: 'POST /api/v1/sessions/{id}/strategy/approve',
  REVISION_REQUESTED: 'POST /api/v1/sessions/{id}/chat',
  CANCEL: 'POST /api/v1/sessions/{id}/cancel',
};

export function isTerminal(state: SessionState): boolean {
  return TRANSITIONS[state] && Object.keys(TRANSITIONS[state]).length === 0;
}

export function nextState(state: SessionState, event: SessionEvent): SessionState | null {
  return TRANSITIONS[state]?.[event] ?? null;
}

export function canTransition(state: SessionState, event: SessionEvent): boolean {
  return nextState(state, event) !== null;
}

export function allowedEvents(state: SessionState): SessionEvent[] {
  return Object.keys(TRANSITIONS[state] ?? {}) as SessionEvent[];
}

export function allowedActions(state: SessionState): string[] {
  return allowedEvents(state)
    .map((e) => EVENT_ACTIONS[e])
    .filter((a): a is string => Boolean(a));
}
