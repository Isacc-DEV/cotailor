import { Injectable } from '@nestjs/common';
import type {
  JdPrecheck,
  JdAnalysis,
  SkillExtraction,
  ResumeStrategy,
  ResumeContent,
  ResumeValidation,
} from '@cotailor/shared';
import type { BulletRewriteInput, LLMProvider, SummaryInput } from './llm-provider.interface';

const CIVIL = /\b(civil|structural|geotechnical|surveying|construction|mechanical engineering)\b/i;

// Deterministic canned responses. Minimally input-aware so both canonical test JDs work:
// a Civil Engineering JD (→ category reject) and the FinTech Full Stack JD (→ subtype gate).
@Injectable()
export class StubLlmProvider implements LLMProvider {
  async precheckJD(jdText: string): Promise<JdPrecheck> {
    const words = jdText.trim().split(/\s+/).filter(Boolean).length;
    return { is_job_description: words >= 50, language: 'en', char_count: jdText.length, red_flags: [] };
  }

  async analyzeJD(jdText: string): Promise<JdAnalysis> {
    if (CIVIL.test(jdText)) {
      return {
        is_job_description: true,
        category: 'Civil/Mechanical Engineering',
        category_confidence: 0.94,
        subtype: 'Structural Engineer',
        subtype_confidence: 0.9,
        domain_keywords: ['construction', 'structural design'],
        summary: 'Civil/Structural Engineering role.',
        language: 'en',
        red_flags: [],
      };
    }
    return {
      is_job_description: true,
      category: 'Software Engineering',
      category_confidence: 0.96,
      subtype: 'Full Stack Engineer',
      subtype_confidence: 0.91,
      domain_keywords: ['payments', 'fintech', 'checkout'],
      summary: 'Full Stack Engineer — FinTech (Payments).',
      language: 'en',
      red_flags: [],
    };
  }

  async extractSkills(jdText: string): Promise<SkillExtraction> {
    if (CIVIL.test(jdText)) {
      return {
        required_skills: ['AutoCAD', 'structural analysis'],
        preferred_skills: [],
        tools: ['AutoCAD'],
        technologies: [],
        responsibilities: ['Site inspection', 'Structural design'],
        soft_skills: [],
        certifications: ['PE License'],
        knockout_requirements: [{ type: 'license', value: 'PE License required', evidence_quote: 'PE License required.' }],
        domain_keywords: ['construction'],
      };
    }
    return {
      required_skills: ['JavaScript', 'Vue', 'Node.js', 'PostgreSQL', 'GCP', 'Kubernetes'],
      preferred_skills: ['Terraform', 'AWS Certified Solutions Architect', 'payments-domain experience'],
      tools: ['Docker'],
      technologies: ['REST'],
      responsibilities: ['Build customer-facing payment flows'],
      soft_skills: [],
      certifications: ['AWS Certified Solutions Architect'],
      knockout_requirements: [
        { type: 'work_authorization', value: 'US work authorization required', evidence_quote: 'US work authorization required.' },
      ],
      domain_keywords: ['payments', 'fintech'],
    };
  }

  async generateResumeStrategy(): Promise<ResumeStrategy> {
    return {
      target_title: 'Senior Full Stack Engineer',
      keywords_to_emphasize: ['Node.js', 'JavaScript', 'PostgreSQL', 'REST'],
      keywords_to_avoid: ['Terraform', 'AWS Certified Solutions Architect'],
      summary_strategy: 'Lead with backend depth; list Vue/GCP/Kubernetes in Skills per user decision.',
      experience_strategy: [
        { company: 'Cartline', title: 'Senior Backend Engineer', surface: ['checkout flows', 'Node.js/PostgreSQL'] },
      ],
      skill_strategy: [
        { jd_skill: 'Vue', action: 'List Vue in Skills; React bullet untouched', provenance: 'user_confirmed', bullet_action: 'skills_only', anchor: null },
        { jd_skill: 'GCP', action: 'List GCP in Skills; AWS bullets untouched', provenance: 'user_confirmed', bullet_action: 'skills_only', anchor: null },
        { jd_skill: 'Kubernetes', action: 'List Kubernetes in Skills; Docker/AWS bullet untouched', provenance: 'user_confirmed', bullet_action: 'skills_only', anchor: null },
      ],
      style: 'balanced',
      risk_notes: ['Vue, GCP, Kubernetes are required but listed in Skills only — not demonstrated.'],
      assumed_defaults: [
        { item: 'Terraform (preferred)', default_applied: 'omit_and_report', reason: 'Missing preferred skill; auto-resolved.' },
      ],
      predicted_match_score: 83,
    };
  }

  async generateResume(): Promise<ResumeContent> {
    return {
      header: { name: 'Alex', email: 'alex@example.com', links: [] },
      target_title: 'Senior Full Stack Engineer',
      summary: 'Senior engineer with deep Node.js/PostgreSQL backend expertise and production React experience.',
      skills: [
        { group: 'Backend', items: ['Node.js', 'NestJS', 'PostgreSQL', 'Redis'] },
        { group: 'Cloud & DevOps', items: ['AWS', 'Docker', 'GCP', 'Kubernetes'] },
        { group: 'Frontend', items: ['React', 'TypeScript', 'Vue'] },
      ],
      experience: [
        {
          company: 'Cartline',
          title: 'Senior Backend Engineer',
          start: '2021-03',
          end: null,
          bullets: [
            {
              text: 'Developed Node.js and NestJS backend services with PostgreSQL data models for high-volume e-commerce checkout flows.',
              provenance: 'profile_verified',
              skills_referenced: ['Node.js', 'NestJS', 'PostgreSQL'],
            },
            {
              text: 'Deployed and operated containerized services with Docker on AWS, automating build and release workflows.',
              provenance: 'profile_verified',
              skills_referenced: ['Docker', 'AWS'],
            },
          ],
        },
      ],
      projects: [],
      education: [],
      certifications: [],
    };
  }

  async validateResume(): Promise<ResumeValidation> {
    return {
      passed: true,
      match_score: 83,
      ats_score: 84,
      recruiter_score: 88,
      warnings: [
        'Kubernetes is required; it is listed in your Skills but not shown in your experience, per your decision (Skills-only).',
      ],
      missing_required_skills: [],
      unsupported_claims: [],
      implausible_claims: [],
      blocked_terms_found: [],
      omitted_skill_leaks: [],
      suggested_improvements: ['Quantify the checkout-throughput bullet at Cartline with a concrete figure.'],
    };
  }

  async reviseResume(): Promise<ResumeContent> {
    return this.generateResume();
  }

  // Deterministic placeholder wording. Real, natural phrasing arrives when the
  // Claude provider implements this same method (Approach 2 seam).
  async rewriteBullet(input: BulletRewriteInput): Promise<{ text: string }> {
    const { bullet, skill, mode, relatedSkill } = input;
    const strip = (t: string) => t.replace(/\s*\.\s*$/, '');

    // Style fixes need a real LLM; the stub returns the bullet unchanged.
    if (mode === 'style') {
      return { text: bullet };
    }

    if (mode === 'add' || !bullet.trim()) {
      return { text: `Applied ${skill} to build and ship production features.` };
    }

    if (relatedSkill) {
      const re = new RegExp(relatedSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (mode === 'exchange') {
        return {
          text: re.test(bullet) ? bullet.replace(re, skill) : `${strip(bullet)}, using ${skill}.`,
        };
      }
      // both
      return {
        text: re.test(bullet)
          ? bullet.replace(re, `${relatedSkill} and ${skill}`)
          : `${strip(bullet)} with ${relatedSkill} and ${skill}.`,
      };
    }

    return { text: `${strip(bullet)}, including ${skill}.` };
  }

  // Deterministic summary from the final content; real phrasing needs Gemini.
  async writeSummary(input: SummaryInput): Promise<{ text: string }> {
    const role = input.targetRole ?? 'Engineer';
    const top = input.skills.slice(0, 4).join(', ');
    const years = input.experiences.length;
    return {
      text: `${role} with hands-on experience across ${years} role${years === 1 ? '' : 's'}, working with ${top}. Focused on building reliable, production-grade systems.`,
    };
  }
}
