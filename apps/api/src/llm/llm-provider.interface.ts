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
}
