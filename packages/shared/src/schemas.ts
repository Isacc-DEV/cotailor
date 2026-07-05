// The six canonical LLM output schemas (design Section 0.5). Every LLM call
// returns JSON validated against one of these before the backend trusts it.
import { z } from 'zod';

const evidence = z.object({ value: z.string(), evidence_quote: z.string() });

// #1 JD Analysis Output (Section 9)
export const jdAnalysisSchema = z.object({
  is_job_description: z.boolean(),
  category: z.string(),
  category_confidence: z.number().min(0).max(1),
  subtype: z.string(),
  subtype_confidence: z.number().min(0).max(1),
  domain_keywords: z.array(z.string()),
  summary: z.string(),
  language: z.string(),
  red_flags: z.array(z.string()),
});
export type JdAnalysis = z.infer<typeof jdAnalysisSchema>;

// pre-check (Section 16.2) — cheap, distinct from the full analysis
export const jdPrecheckSchema = z.object({
  is_job_description: z.boolean(),
  language: z.string(),
  char_count: z.number().int().nonnegative(),
  red_flags: z.array(z.string()),
});
export type JdPrecheck = z.infer<typeof jdPrecheckSchema>;

// #2 Skill Extraction Output (Section 9)
// Focused shape: exhaustive skill/tool/platform keywords in three priority
// buckets, plus certifications and hard-gate knockouts. Legacy descriptive
// buckets are optional for backward compatibility with stored raw analyses.
export const skillExtractionSchema = z.object({
  required_skills: z.array(z.string()),
  preferred_skills: z.array(z.string()),
  mentioned_skills: z.array(z.string()).optional(),
  all_keywords: z.array(z.string()).optional(),
  certifications: z.array(z.string()),
  knockout_requirements: z.array(
    z.object({
      // Free-form; the backend gate applies a strict allowlist (GatesService).
      type: z.string(),
      value: z.string(),
      evidence_quote: z.string(),
    }),
  ),
  // Legacy fields (older stored analyses) — no longer produced by extraction.
  tools: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  soft_skills: z.array(z.string()).optional(),
  domain_keywords: z.array(z.string()).optional(),
});
export type SkillExtraction = z.infer<typeof skillExtractionSchema>;

// #3 Skill Match Output (Section 10)
export const skillMatchSchema = z.object({
  jd_skill: z.string(),
  priority: z.enum(['required', 'preferred']),
  match_type: z.enum(['exact', 'equivalent', 'similar_stack', 'same_family', 'missing', 'blocked_sensitive']),
  profile_match: z.string().nullable(),
  similarity: z.number().min(0).max(1).nullable(),
  risk_level: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  recommended_action: z.string(),
  needs_user_decision: z.boolean(),
  evidence_quote: z.string(),
});
export type SkillMatch = z.infer<typeof skillMatchSchema>;

// #4 Decision Card Output (Section 7)
export const decisionCardSchema = z.object({
  card_type: z.enum([
    'category_mismatch',
    'category_low_confidence',
    'subtype_mismatch',
    'knockout_requirement',
    'missing_required_skill',
    'similar_skill',
    'certification_risk',
    'resume_style',
    'strategy_approval',
  ]),
  title: z.string(),
  message: z.string(),
  options: z.array(
    z.object({ option_id: z.string(), label: z.string(), consequence: z.string() }),
  ).min(2),
  recommended_option: z.string().nullable(),
  severity: z.enum(['info', 'warning', 'blocking', 'critical']),
  context: z.record(z.any()),
});
export type DecisionCard = z.infer<typeof decisionCardSchema>;

// #5 Resume Strategy Output (Section 11)
export const resumeStrategySchema = z.object({
  target_title: z.string(),
  keywords_to_emphasize: z.array(z.string()),
  keywords_to_avoid: z.array(z.string()),
  summary_strategy: z.string(),
  experience_strategy: z.array(
    z.object({ company: z.string(), title: z.string(), surface: z.array(z.string()) }),
  ),
  skill_strategy: z.array(
    z.object({
      jd_skill: z.string(),
      action: z.string(),
      provenance: z.enum(['profile_verified', 'user_confirmed', 'omitted']),
      bullet_action: z.enum(['emphasize_existing', 'replace', 'update', 'add_bullet', 'skills_only', 'none']),
      anchor: z.string().nullable(),
    }),
  ),
  style: z.enum(['ats_strong', 'recruiter_friendly', 'balanced']),
  risk_notes: z.array(z.string()),
  assumed_defaults: z.array(
    z.object({ item: z.string(), default_applied: z.string(), reason: z.string() }),
  ),
  predicted_match_score: z.number().int().min(0).max(100),
});
export type ResumeStrategy = z.infer<typeof resumeStrategySchema>;

// #6 Resume Validation Output (Section 12)
const located = z.object({ claim: z.string(), location: z.string(), reason: z.string() });
export const resumeValidationSchema = z.object({
  passed: z.boolean(),
  match_score: z.number().int().min(0).max(100),
  ats_score: z.number().int().min(0).max(100),
  recruiter_score: z.number().int().min(0).max(100),
  warnings: z.array(z.string()),
  missing_required_skills: z.array(z.string()),
  unsupported_claims: z.array(located),
  implausible_claims: z.array(located),
  blocked_terms_found: z.array(z.object({ term: z.string(), location: z.string() })),
  omitted_skill_leaks: z.array(z.object({ skill: z.string(), location: z.string() })),
  suggested_improvements: z.array(z.string()),
});
export type ResumeValidation = z.infer<typeof resumeValidationSchema>;

// content_json shape (Section 0.8)
export const bulletSchema = z.object({
  text: z.string(),
  provenance: z.enum(['profile_verified', 'user_confirmed', 'omitted']),
  skills_referenced: z.array(z.string()),
});
export const resumeContentSchema = z.object({
  header: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()).default([]),
  }),
  target_title: z.string(),
  summary: z.string(),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      start: z.string(),
      end: z.string().nullable(),
      bullets: z.array(bulletSchema),
    }),
  ),
  projects: z.array(z.any()).default([]),
  education: z.array(z.any()).default([]),
  certifications: z.array(z.any()).default([]),
});
export type ResumeContent = z.infer<typeof resumeContentSchema>;
