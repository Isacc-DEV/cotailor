import { Inject, Injectable, Logger } from '@nestjs/common';
import { scoreExperienceForSkill } from '@cotailor/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LLM_PROVIDER, type LLMProvider } from '../llm/llm-provider.interface';
import { lintResume, type QualityReport } from './resume-quality';

// Applies the user's card decisions to the pinned profile snapshot to produce a
// tailored resume (design Section 11). Per Approach 2, each bullet edit is a
// single narrow LLM rewrite; everything the user didn't touch is left exactly as
// their real experience. Deterministic and rebuildable from decisions, so we
// compute on demand rather than persisting (no Resume table exists yet).
interface Bullet {
  text: string;
  provenance: 'profile_verified' | 'user_confirmed';
  /** Pre-rewrite text (exchange/both) — enables "Revert to original" in review. */
  originalText?: string;
  /** True for brand-new bullets (add_experience) — revert means remove. */
  added?: boolean;
}
interface Experience {
  company: string;
  position?: string;
  startDate?: string;
  endDate?: string | null;
  location?: string;
  description?: string;
  bullets: Bullet[];
  technologies: string[];
  impact?: string;
}
interface ChangeLogEntry {
  skill: string;
  action: string;
  where: string;
}
export interface BuiltResume {
  header: Record<string, unknown>;
  summary?: string;
  skills: string[];
  workExperience: Experience[];
  education: unknown[];
  certifications: any[];
  changeLog: ChangeLogEntry[];
  qualityReport: QualityReport;
}

@Injectable()
export class ResumeBuilderService {
  private readonly logger = new Logger(ResumeBuilderService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
  ) {}

  async build(sessionId: string): Promise<BuiltResume> {
    const session = await this.prisma.tailoringSession.findUniqueOrThrow({ where: { id: sessionId } });
    const snap =
      session.profileSnapshot && typeof session.profileSnapshot === 'object'
        ? (session.profileSnapshot as any)
        : {};

    // Start from the pinned profile; everything begins as verified experience.
    const workExperience: Experience[] = (Array.isArray(snap.workExperience) ? snap.workExperience : []).map(
      (e: any) => ({
        company: e.company,
        position: e.position,
        startDate: e.startDate,
        endDate: e.endDate ?? null,
        location: e.location,
        description: e.description,
        technologies: Array.isArray(e.technologies) ? [...e.technologies] : [],
        impact: e.impact,
        bullets: (Array.isArray(e.bullets) ? e.bullets : []).map((b: string) => ({
          text: b,
          provenance: 'profile_verified' as const,
        })),
      }),
    );
    const skills: string[] = Array.isArray(snap.skills) ? [...snap.skills] : [];
    const certifications: any[] = Array.isArray(snap.certifications) ? [...snap.certifications] : [];
    const changeLog: ChangeLogEntry[] = [];

    const addSkill = (s: string) => {
      if (!skills.some((x) => x.toLowerCase() === s.toLowerCase())) skills.push(s);
    };

    // Answered cards + their chosen option.
    const cards = await this.prisma.decisionCard.findMany({ where: { sessionId } });
    const decisions = await this.prisma.userDecision.findMany({ where: { sessionId } });
    const optionByCard = new Map(decisions.map((d) => [d.cardId, d.optionId]));

    // Pick the most relevant job for a NEW bullet: relevance to the skill first
    // (related tech/bullets), then spread across jobs (fewest bullets added so
    // far), then recency. Prevents every added bullet stacking on the latest job.
    const addedCount = new Array(workExperience.length).fill(0);
    const pickExperienceForSkill = (skill: string): number => {
      if (workExperience.length === 0) return -1;
      let best = 0;
      let bestKey = [-Infinity, Infinity, Infinity]; // [score, added, index]
      workExperience.forEach((exp, i) => {
        const score = scoreExperienceForSkill(
          { bullets: exp.bullets.map((b) => b.text), technologies: exp.technologies, description: exp.description },
          skill,
        );
        const key = [score, -addedCount[i], -i];
        const better =
          key[0] > bestKey[0] ||
          (key[0] === bestKey[0] && key[1] > bestKey[1]) ||
          (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] > bestKey[2]);
        if (better) {
          best = i;
          bestKey = key;
        }
      });
      return best;
    };

    for (const card of cards) {
      const option = optionByCard.get(card.id);
      if (!option) continue;
      const payload = (card.payload ?? {}) as any;
      const ctx = payload.context ?? {};

      if (card.cardType === 'similar_skill') {
        const jdSkill: string = ctx.jd_skill;
        const profileSkill: string = ctx.profile_skill;
        const rel = ctx.relevant_bullet as { experienceIndex: number; bulletIndex: number } | null;

        if (option === 'omit') continue;
        if (option === 'skills_only') {
          addSkill(jdSkill);
          changeLog.push({ skill: jdSkill, action: 'skills_only', where: 'Skills' });
          continue;
        }
        // exchange or both
        if (rel && rel.bulletIndex >= 0 && workExperience[rel.experienceIndex]?.bullets[rel.bulletIndex]) {
          const target = workExperience[rel.experienceIndex].bullets[rel.bulletIndex];
          const before = target.text;
          const { text } = await this.llm.rewriteBullet({
            bullet: target.text,
            skill: jdSkill,
            mode: option === 'exchange' ? 'exchange' : 'both',
            relatedSkill: profileSkill,
          });
          target.text = text;
          target.originalText = before;
          target.provenance = 'user_confirmed';
          addSkill(jdSkill);
          changeLog.push({
            skill: jdSkill,
            action: option,
            where: `${workExperience[rel.experienceIndex].company} bullet`,
          });
        } else {
          // No relevant bullet found → fall back to Skills.
          addSkill(jdSkill);
          changeLog.push({ skill: jdSkill, action: 'skills_only (no bullet)', where: 'Skills' });
        }
        continue;
      }

      if (card.cardType === 'missing_required_skill') {
        const jdSkill: string = ctx.jd_skill;
        if (option === 'omit') continue;
        if (option === 'skills_only') {
          addSkill(jdSkill);
          changeLog.push({ skill: jdSkill, action: 'skills_only', where: 'Skills' });
          continue;
        }
        if (option === 'add_experience') {
          // A skill can land in EVERY relevant job (capped at 3 to avoid
          // over-claiming), each with its own wording grounded in that job's
          // stack. No relevant job → single bullet on the best fallback pick.
          const MAX_PLACEMENTS = 3;
          const relevant = workExperience
            .map((exp, i) => ({
              i,
              score: scoreExperienceForSkill(
                { bullets: exp.bullets.map((b) => b.text), technologies: exp.technologies, description: exp.description },
                jdSkill,
              ),
            }))
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score || a.i - b.i)
            .slice(0, MAX_PLACEMENTS)
            .map((s) => s.i);

          const targets = relevant.length > 0 ? relevant : [pickExperienceForSkill(jdSkill)].filter((i) => i >= 0);

          if (targets.length === 0) {
            addSkill(jdSkill);
            changeLog.push({ skill: jdSkill, action: 'skills_only (no jobs)', where: 'Skills' });
            continue;
          }

          for (const idx of targets) {
            const target = workExperience[idx];
            const { text } = await this.llm.rewriteBullet({
              bullet: '',
              skill: jdSkill,
              mode: 'add',
              context: `${target.position ?? 'role'} at ${target.company}${
                target.technologies.length ? `, tech stack: ${target.technologies.join(', ')}` : ''
              }`,
            });
            target.bullets.push({ text, provenance: 'user_confirmed', added: true });
            addedCount[idx]++;
            changeLog.push({ skill: jdSkill, action: 'add_bullet', where: `${target.company}` });
          }
          addSkill(jdSkill);
        }
        continue;
      }

      if (card.cardType === 'certification_risk') {
        const cert: string = ctx.certification;
        const catalogId: string | undefined = ctx.catalogId;
        const already = certifications.some(
          (c: any) => String(c?.name ?? '').toLowerCase() === cert.toLowerCase(),
        );
        if (!already && option === 'studying') {
          certifications.push({ name: cert, status: 'in progress', catalogId });
          changeLog.push({ skill: cert, action: 'studying', where: 'Certifications' });
        } else if (!already && option === 'have_it') {
          certifications.push({ name: cert, catalogId });
          changeLog.push({ skill: cert, action: 'added', where: 'Certifications' });
        }
        continue;
      }
      // subtype_mismatch: no resume change.
    }

    // Summary is written LAST, from the final tailored content (all bullets
    // settled), targeted at the JD role. Profiles don't carry summaries — this
    // is always derived. A failure here degrades to "no summary section", never
    // to a broken build.
    let summary: string | undefined;
    try {
      const analysisRow = await this.prisma.jdAnalysis.findFirst({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
      });
      const { text } = await this.llm.writeSummary({
        targetRole: analysisRow?.subtype ?? analysisRow?.category ?? undefined,
        skills,
        experiences: workExperience.map((e) => ({
          company: e.company,
          position: e.position,
          bullets: e.bullets.map((b) => b.text),
        })),
        domainKeywords: analysisRow?.domainKeywords ?? [],
      });
      summary = text || undefined;
    } catch (e) {
      this.logger.warn(`writeSummary failed; resume built without a summary: ${e instanceof Error ? e.message : e}`);
    }

    // Final check: deterministic style lint (buzzwords, repeated openers,
    // punctuation/capitalization consistency, bullet length).
    const qualityReport = lintResume(workExperience, summary);

    return {
      header: snap.header ?? {},
      summary,
      skills,
      workExperience,
      education: Array.isArray(snap.education) ? snap.education : [],
      certifications,
      changeLog,
      qualityReport,
    };
  }
}
