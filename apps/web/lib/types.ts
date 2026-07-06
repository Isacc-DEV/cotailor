// Session Types
export interface Session {
  id: string;
  profileId: string;
  state: SessionState;
  jdText?: string;
  analysisResults?: JDAnalysis;
  pendingCards?: Card[];
  decisions?: Decision[];
  strategy?: Strategy;
  resume?: Resume;
  createdAt: string;
  updatedAt: string;
}

export type SessionState =
  | 'created'
  | 'jd_submitted'
  | 'analyzing'
  | 'category_rejected'
  | 'waiting_category_confirmation'
  | 'waiting_subtype_confirmation'
  | 'waiting_skill_decisions'
  | 'strategy_review'
  | 'generating'
  | 'validating'
  | 'needs_revision'
  | 'revising'
  | 'final_ready'
  | 'cancelled'
  | 'expired';

// Profile Types
export interface Profile {
  id: string;
  name: string;
  category: string;
  subtype?: string;
  skills: string[];
  certifications?: string[];
  baseResume: string;
  workAuthorization?: string;
  createdAt: string;
  updatedAt: string;
}

// JD Analysis Types
export interface JDAnalysis {
  category: string;
  subtype?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  certifications?: string[];
  domainKeywords: string[];
}

// Decision Card Types
export interface Card {
  id: string;
  sessionId: string;
  type: CardType;
  severity: CardSeverity;
  status: CardStatus;
  title: string;
  description: string;
  options?: CardOption[];
  metadata?: any;
  createdAt: string;
}

export type CardType =
  | 'category_low_confidence'
  | 'subtype_mismatch'
  | 'missing_required_skill'
  | 'similar_skill'
  | 'certification_risk'
  | 'resume_style'
  | 'strategy_approval';

export type CardSeverity = 'info' | 'warning' | 'blocking' | 'critical';
export type CardStatus = 'pending' | 'answered' | 'auto_resolved';

export interface CardOption {
  value: string;
  label: string;
  description?: string;
}

export interface Decision {
  cardId: string;
  answer: string | string[] | boolean;
  timestamp: string;
}

// Strategy Types
export interface Strategy {
  targetTitle: string;
  emphasis: string[];
  avoid: string[];
  perRolePlan: string;
  style: ResumeStyle;
  assumedDefaults: Record<string, any>;
  predictedScore: number;
}

export type ResumeStyle = 'ats_strong' | 'recruiter_friendly' | 'balanced';

// Resume Types
export interface Resume {
  id: string;
  sessionId: string;
  content: string;
  sections: ResumeSection[];
  provenance: Record<string, Provenance>;
  atsScore: number;
  recruiterReadability: number;
  warnings: string[];
  changesFromBase: string[];
}

export interface ResumeSection {
  title: string;
  bullets: ResumeBullet[];
}

export interface ResumeBullet {
  text: string;
  provenance: Provenance;
  emphasized: boolean;
  omitted: boolean;
}

export type Provenance = 'profile_verified' | 'user_confirmed' | 'omitted';

// Match Types
export interface SkillMatch {
  jdSkill: string;
  profileSkill?: string;
  matchType: MatchType;
  riskLevel: RiskLevel;
  recommendation: string;
}

export type MatchType = 'exact' | 'equivalent' | 'similar_stack' | 'same_family' | 'missing' | 'blocked_sensitive';
export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

// Validation Types
export interface ValidationResult {
  passed: boolean;
  contentChecks: CheckResult[];
  recruiterReadability: CheckResult;
  atsScore: number;
  warnings: ValidationWarning[];
}

export interface CheckResult {
  name: string;
  passed: boolean;
  message?: string;
}

export interface ValidationWarning {
  severity: 'warning' | 'critical';
  message: string;
}

// API Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string; code: string };
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
