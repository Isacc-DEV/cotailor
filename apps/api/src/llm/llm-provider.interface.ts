import type {
  JdPrecheck,
  JdAnalysis,
  SkillExtraction,
  ResumeStrategy,
  ResumeContent,
  ResumeValidation,
} from '@cotailor/shared';

// DI token for the active LLM provider (design Section 16).
export const LLM_PROVIDER = 'LLM_PROVIDER';

// Per-bullet rewrite (Approach 2): the LLM only ever reshapes ONE bullet with a
// narrow instruction, never the whole resume — this keeps edits truthful and
// approvable. `mode`: exchange = present relatedSkill as skill; both = mention
// both; add = draft a brand-new bullet for the skill; style = fix wording per
// `instruction` (buzzwords, repeated openers) without changing any facts.
export interface BulletRewriteInput {
  bullet: string;
  skill: string;
  mode: 'exchange' | 'both' | 'add' | 'style';
  relatedSkill?: string;
  instruction?: string;
  /** Job context for `add` mode (company tech stack) so each added bullet reads differently. */
  context?: string;
}

// Summary generation input: the FINAL tailored resume content (bullets already
// settled), so the summary reflects what the resume actually says — never the
// raw profile.
export interface SummaryInput {
  targetRole?: string;
  skills: string[];
  experiences: Array<{ company: string; position?: string; bullets: string[] }>;
  domainKeywords?: string[];
}

// Pure-function contract: typed input in, schema-validated JSON out.
// The LLM never drives workflow — the backend state machine does.
export interface LLMProvider {
  precheckJD(jdText: string): Promise<JdPrecheck>;
  analyzeJD(jdText: string): Promise<JdAnalysis>;
  extractSkills(jdText: string): Promise<SkillExtraction>;
  generateResumeStrategy(input: unknown): Promise<ResumeStrategy>;
  generateResume(input: unknown): Promise<ResumeContent>;
  validateResume(input: unknown): Promise<ResumeValidation>;
  reviseResume(input: unknown): Promise<ResumeContent>;
  rewriteBullet(input: BulletRewriteInput): Promise<{ text: string }>;
  writeSummary(input: SummaryInput): Promise<{ text: string }>;
}
