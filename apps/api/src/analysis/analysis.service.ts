import { Inject, Injectable, Logger } from '@nestjs/common';
import type { JdAnalysis, SkillExtraction, CertSelectionResult } from '@cotailor/shared';
import {
  classifySkill,
  findRelevantBullet,
  isSpecificSkill,
  jdAnalysisSchema,
  skillExtractionSchema,
  profileHoldsCert,
} from '@cotailor/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LLM_PROVIDER, type LLMProvider } from '../llm/llm-provider.interface';
import { GatesService } from '../core/gates.service';
import { CardsService } from '../core/cards.service';
import { SessionTransitionService } from '../core/session-transition.service';
import { EventsService } from '../core/events.service';
import { CertificationsService } from '../certifications/certifications.service';

interface RunOpts {
  trustCategory?: boolean;
  confirmedCategory?: string;
}

// Orchestrates one-pass analysis + staged gate evaluation (design Sections 8, 9).
// Runs as a fire-and-forget in-process job for now; the same run() is what a
// BullMQ processor will call once durable queuing is added (Section 15).
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
    private readonly gates: GatesService,
    private readonly cards: CardsService,
    private readonly transitions: SessionTransitionService,
    private readonly events: EventsService,
    private readonly certs: CertificationsService,
  ) {}

  // LLM JSON is untrusted: despite the prompt contract, models occasionally
  // return null or drop a field, and JdAnalysis columns are NOT NULL — that
  // crashes the insert with an unhelpful "Null constraint violation". Validate
  // against the shared schema; on mismatch coerce safe defaults so a sloppy
  // response degrades into the low-confidence flow instead of a crash.
  private normalizeAnalysis(raw: unknown): JdAnalysis {
    const parsed = jdAnalysisSchema.safeParse(raw);
    if (parsed.success) return parsed.data;

    const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
    const num01 = (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0;
    const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

    const bad = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    this.logger.warn(`analyzeJD response failed schema validation (fields: ${bad}); coercing safe defaults.`);

    const category = str(a.category, 'Unknown');
    return {
      is_job_description: a.is_job_description !== false,
      category,
      category_confidence: num01(a.category_confidence),
      subtype: str(a.subtype, category),
      subtype_confidence: num01(a.subtype_confidence),
      domain_keywords: strs(a.domain_keywords),
      summary: str(a.summary, ''),
      language: str(a.language, 'en'),
      red_flags: strs(a.red_flags),
    };
  }

  private normalizeExtraction(raw: unknown): SkillExtraction {
    const parsed = skillExtractionSchema.safeParse(raw);
    if (parsed.success) return parsed.data;

    const e = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

    const bad = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    this.logger.warn(`extractSkills response failed schema validation (fields: ${bad}); coercing safe defaults.`);

    return {
      required_skills: strs(e.required_skills),
      preferred_skills: strs(e.preferred_skills),
      mentioned_skills: strs(e.mentioned_skills),
      certifications: strs(e.certifications),
    };
  }

  async run(sessionId: string, opts: RunOpts = {}): Promise<void> {
    const session = await this.prisma.tailoringSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { profile: { include: { subtypes: true } }, jdDocument: true },
    });
    const jdText = session.jdDocument?.text ?? '';

    this.events.emit(sessionId, 'analysis_progress', { stage: 'reading_jd', pct: 10 });

    // Reuse a stored analysis (idempotent re-run after a category confirmation), else extract.
    let analysisRow = await this.prisma.jdAnalysis.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    let analysis: JdAnalysis;
    let extraction: SkillExtraction;
    if (analysisRow) {
      const raw = analysisRow.raw as { analysis: unknown; extraction: unknown };
      analysis = this.normalizeAnalysis(raw.analysis);
      extraction = this.normalizeExtraction(raw.extraction);
    } else {
      analysis = this.normalizeAnalysis(await this.llm.analyzeJD(jdText));
      extraction = this.normalizeExtraction(await this.llm.extractSkills(jdText));
      await this.prisma.jdAnalysis.create({
        data: {
          sessionId,
          jdDocumentId: session.jdDocumentId as string,
          category: analysis.category,
          categoryConfidence: analysis.category_confidence,
          subtype: analysis.subtype,
          subtypeConfidence: analysis.subtype_confidence,
          domainKeywords: analysis.domain_keywords,
          summary: analysis.summary,
          raw: { analysis, extraction } as never,
          promptVersion: 'stub@v1',
          modelUsed: 'stub',
        },
      });
    }

    // ---- Category gate (hard, confidence-banded) ----
    this.events.emit(sessionId, 'analysis_progress', { stage: 'checking_category', pct: 40 });
    const category = opts.confirmedCategory ?? analysis.category;
    const confidence = opts.trustCategory ? 1 : analysis.category_confidence;
    const cat = this.gates.evaluateCategory(session.profile.category, category, confidence);

    if (cat.kind === 'low_confidence') {
      await this.cards.create(sessionId, 'category_low_confidence', 'blocking', {
        card_type: 'category_low_confidence',
        title: 'Is this the right field?',
        message: `This JD looks like ${cat.detected} (${Math.round(cat.confidence * 100)}% confident). Is that right?`,
        options: [
          { option_id: 'confirm', label: `Yes, it's ${cat.detected}`, consequence: 'The category gate re-evaluates strictly.' },
          { option_id: 'correct', label: 'No, pick the correct category', consequence: 'Provide the right category; the gate re-evaluates.' },
          { option_id: 'cancel', label: 'Cancel', consequence: 'Ends this session.' },
        ],
        recommended_option: 'confirm',
        severity: 'blocking',
        context: { detected: cat.detected, confidence: cat.confidence, profile_category: session.profile.category },
      });
      this.events.emit(sessionId, 'gate_result', { gate: 'category', result: 'low_confidence' });
      await this.transitions.apply(sessionId, 'ANALYSIS_CATEGORY_LOW_CONF', 'CATEGORY_LOW_CONFIDENCE');
      return;
    }

    if (cat.kind === 'reject') {
      await this.cards.create(sessionId, 'category_mismatch', 'blocking', {
        card_type: 'category_mismatch',
        title: "This job doesn't match your profile's category.",
        message: `Your profile: ${cat.profileCategory}. This JD: ${cat.detected} (confidence ${cat.confidence.toFixed(2)}). Tailoring across these categories would misrepresent your experience, so generation is blocked.`,
        options: [
          { option_id: 'select_another_profile', label: 'Select Another Profile', consequence: 'Start over with a different profile.' },
          { option_id: 'use_another_jd', label: 'Use Another JD', consequence: 'Start over with a different job description.' },
        ],
        recommended_option: null,
        severity: 'blocking',
        context: { profile_category: cat.profileCategory, jd_category: cat.detected, confidence: cat.confidence },
      });
      this.events.emit(sessionId, 'gate_result', { gate: 'category', result: 'rejected', jd_category: cat.detected });
      await this.transitions.apply(sessionId, 'ANALYSIS_CATEGORY_REJECTED', 'CATEGORY_REJECTED');
      return;
    }
    this.events.emit(sessionId, 'gate_result', { gate: 'category', result: 'passed' });

    // ---- Subtype gate (soft, relation-aware) ----
    this.events.emit(sessionId, 'analysis_progress', { stage: 'checking_subtype', pct: 65 });
    const profileSubtype = session.profile.subtypes[0]?.name ?? '';
    const sub = this.gates.evaluateSubtype(profileSubtype, analysis);
    if (sub.mismatch) {
      const recommendProceed = sub.relation === 'subsumes' || sub.relation === 'overlaps';
      await this.cards.create(sessionId, 'subtype_mismatch', 'warning', {
        card_type: 'subtype_mismatch',
        title: `This role is ${analysis.subtype}; your profile is ${profileSubtype || 'unspecified'}.`,
        message:
          sub.relation === 'subsumes'
            ? `Your ${profileSubtype} profile covers a large part of this ${analysis.subtype} role — recommended: proceed.`
            : `This JD is a ${analysis.subtype} role; your profile is ${profileSubtype}. This may reduce match quality. Generate anyway?`,
        options: [
          { option_id: 'proceed', label: 'Yes, Generate Anyway', consequence: 'Continue to the skill decisions.' },
          { option_id: 'cancel', label: 'No, Cancel', consequence: 'Ends this session.' },
        ],
        recommended_option: recommendProceed ? 'proceed' : 'cancel',
        severity: 'warning',
        context: { profile_subtype: profileSubtype, jd_subtype: analysis.subtype, relation: sub.relation },
      });
      this.events.emit(sessionId, 'gate_result', { gate: 'subtype', result: 'mismatch', relation: sub.relation });
      this.events.emit(sessionId, 'cards_ready', { state: 'WAITING_SUBTYPE_CONFIRMATION' });
      await this.transitions.apply(sessionId, 'ANALYSIS_SUBTYPE_MISMATCH', 'SUBTYPE_MISMATCH');
      return;
    }
    this.events.emit(sessionId, 'gate_result', { gate: 'subtype', result: 'same' });

    // Subtype matched → open the board.
    await this.transitions.apply(sessionId, 'ANALYSIS_NEEDS_CARDS', 'ANALYSIS_TO_BOARD');
    await this.evaluatePostSubtype(sessionId);
  }

  // Skill-gap cards, evaluated once the subtype gate is cleared.
  async evaluatePostSubtype(sessionId: string): Promise<void> {
    const session = await this.prisma.tailoringSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { profile: true, user: true, jdDocument: true },
    });
    const analysisRow = await this.prisma.jdAnalysis.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    if (!analysisRow) return;
    const raw = analysisRow.raw as { analysis: unknown; extraction: unknown };
    const extraction = this.normalizeExtraction(raw.extraction);

    // ---- Skill gap cards (design Section 9) ----
    await this.createSkillCards(sessionId, session.profile, extraction);

    // ---- Certification suggestions (catalog + AI pick; top-N is a user setting) ----
    await this.createCertificationCards(
      sessionId,
      session.profile,
      analysisRow.category,
      analysisRow.subtype,
      session.jdDocument?.text ?? '',
      session.user?.certSuggestionCount ?? 3,
    );

    this.events.emit(sessionId, 'cards_ready', { state: 'WAITING_SKILL_DECISIONS' });
  }

  // Compares JD skills/certs against the profile and raises decision cards for
  // each REQUIRED gap. Preferred/mentioned gaps auto-resolve to "omit" (assumed
  // defaults). Card cap is generous so exhaustive extraction isn't silently
  // truncated; truncation is logged when it happens.
  private async createSkillCards(
    sessionId: string,
    profile: { baseResume: unknown },
    extraction: SkillExtraction,
  ): Promise<void> {
    const CARD_BUDGET = 20;

    const base =
      profile.baseResume && typeof profile.baseResume === 'object'
        ? (profile.baseResume as any)
        : {};
    const profileSkills: string[] = Array.isArray(base.skills) ? base.skills : [];
    const workExperience: Array<{ bullets?: string[]; technologies?: string[] }> = Array.isArray(
      base.workExperience,
    )
      ? base.workExperience
      : [];

    // How many cards already exist this session (subtype, etc.).
    const existing = await this.cards.listBySession(sessionId);
    let budget = CARD_BUDGET - existing.length;

    // Dedupe case-insensitively and drop bare umbrella terms ("APIs", "Cloud")
    // that extraction should have expanded into concrete items. Buckets are
    // meant to be exclusive but we enforce it here too (required wins).
    const seen = new Set<string>();
    const dedupe = (skills: string[]) =>
      skills.filter((s) => {
        const key = s.trim().toLowerCase();
        if (!key || seen.has(key) || !isSpecificSkill(s)) return false;
        seen.add(key);
        return true;
      });

    const required = dedupe(extraction.required_skills ?? []);
    const preferred = dedupe(extraction.preferred_skills ?? []);
    const mentioned = dedupe(extraction.mentioned_skills ?? []);
    const autoOmitted: string[] = [];

    let truncated = 0;
    for (const jdSkill of required) {
      const c = classifySkill(profileSkills, jdSkill);

      if (c.match === 'exact') continue;

      // Only actual gaps consume budget; count the ones we couldn't show.
      if (budget <= 0) {
        truncated++;
        continue;
      }

      if (c.match === 'similar') {
        const rel = findRelevantBullet(workExperience, c.profileSkill);
        await this.cards.create(sessionId, 'similar_skill', 'warning', {
          card_type: 'similar_skill',
          title: `The job wants ${jdSkill}; you have ${c.profileSkill}.`,
          message: `How should we present it?`,
          options: [
            {
              option_id: 'exchange',
              label: `Exchange — present ${c.profileSkill} as ${jdSkill}`,
              consequence: `A bullet is rewritten to say ${jdSkill}. You'll approve the wording.`,
            },
            {
              option_id: 'both',
              label: `Both — mention ${c.profileSkill} and ${jdSkill}`,
              consequence: `A bullet is rewritten to include both. You'll approve the wording.`,
            },
            {
              option_id: 'skills_only',
              label: `Add ${jdSkill} to Skills only`,
              consequence: 'Listed in Skills; work history untouched.',
            },
            { option_id: 'omit', label: 'Leave it out', consequence: `${jdSkill} is not added.` },
          ],
          // Recommended = strongest honest option: name both the held skill and
          // the JD skill together. User opts in per card (or via bulk-accept).
          recommended_option: 'both',
          severity: 'warning',
          context: {
            jd_skill: jdSkill,
            profile_skill: c.profileSkill,
            relevant_bullet: rel,
            risk_note: `${jdSkill} claimed via ${c.profileSkill} similarity — be ready to speak to it.`,
          },
        });
        budget--;
        continue;
      }

      // missing
      await this.cards.create(sessionId, 'missing_required_skill', 'blocking', {
        card_type: 'missing_required_skill',
        title: `The job requires ${jdSkill}, which isn't on your profile.`,
        message: '',
        options: [
          {
            option_id: 'add_experience',
            label: `Add a new bullet for ${jdSkill}`,
            consequence: `A new bullet is drafted. You'll approve the wording.`,
          },
          {
            option_id: 'skills_only',
            label: `Add ${jdSkill} to Skills only`,
            consequence: 'Listed in Skills; work history untouched.',
          },
          { option_id: 'omit', label: 'Leave it out', consequence: `${jdSkill} is not added.` },
        ],
        // Recommended = add a bullet for the required skill. It's a truth-gated
        // claim (the card fires only when nothing close exists), so the user
        // affirms it by choosing it — nothing is added unless they act.
        recommended_option: 'add_experience',
        severity: 'blocking',
        context: { jd_skill: jdSkill },
      });
      budget--;
    }

    if (truncated > 0) {
      this.logger.warn(
        `Session ${sessionId}: card budget (${CARD_BUDGET}) hit — ${truncated} required-skill gap(s) not shown as cards.`,
      );
    }

    // Preferred/mentioned gaps auto-resolve to omit (assumed defaults, no card).
    const unmatchedMentioned: string[] = [];
    for (const jdSkill of preferred) {
      if (classifySkill(profileSkills, jdSkill).match !== 'exact') autoOmitted.push(jdSkill);
    }
    for (const jdSkill of mentioned) {
      if (classifySkill(profileSkills, jdSkill).match !== 'exact') unmatchedMentioned.push(jdSkill);
    }
    if (autoOmitted.length > 0 || unmatchedMentioned.length > 0) {
      this.events.emit(sessionId, 'assumed_defaults', {
        omitted_preferred_skills: autoOmitted,
        unmatched_mentioned_skills: unmatchedMentioned,
      });
    }

  }

  // Certification suggestions (catalog + AI pick). We hand the AI the manager's
  // certs for this category/subtype and it returns the top-N that fit the job.
  // Certs the user already holds are on the resume via the profile snapshot; each
  // remaining pick becomes a small "add / studying / omit" card the user decides.
  private async createCertificationCards(
    sessionId: string,
    profile: { baseResume: unknown },
    category: string,
    subtype: string,
    jdText: string,
    topN: number,
  ): Promise<void> {
    if (topN <= 0) return;
    const candidates = await this.certs.candidatesForJob(category, subtype);
    if (!candidates.length) return;

    const base =
      profile.baseResume && typeof profile.baseResume === 'object' ? (profile.baseResume as any) : {};
    const profileCerts: Array<{ name?: string; catalogId?: string | null }> = Array.isArray(
      base.certifications,
    )
      ? base.certifications
      : [];

    let selection: CertSelectionResult;
    try {
      selection = await this.llm.selectCertifications({
        jdText,
        subtype,
        candidates: candidates.map((c) => ({
          id: c.id,
          name: c.name,
          issuer: c.issuer,
          aliases: c.aliases,
        })),
        topN,
      });
    } catch (err) {
      this.logger.warn(
        `Session ${sessionId}: cert selection failed (${err instanceof Error ? err.message : String(err)}); skipping cert suggestions.`,
      );
      return;
    }

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const alreadyHeld: string[] = [];
    for (const pick of selection.selected.slice(0, topN)) {
      const cert = byId.get(pick.catalogId);
      if (!cert) continue;
      // Held certs are already in the profile snapshot → already on the resume.
      if (profileHoldsCert(cert, profileCerts)) {
        alreadyHeld.push(cert.name);
        continue;
      }
      await this.cards.create(sessionId, 'certification_risk', 'warning', {
        card_type: 'certification_risk',
        title: `${cert.name} is a strong fit for this job.`,
        message: `Issued by ${cert.issuer}.`,
        options: [
          { option_id: 'have_it', label: 'I have it — add it', consequence: 'Added to your Certifications.' },
          { option_id: 'studying', label: "I'm studying for it", consequence: 'Shown as in progress.' },
          { option_id: 'omit', label: 'Leave it out', consequence: 'Not mentioned.' },
        ],
        // Recommended = claim the cert. Truth-gated (only the user knows they
        // hold it), so it's added only when the user picks this option.
        recommended_option: 'have_it',
        severity: 'warning',
        context: { certification: cert.name, catalogId: cert.id, issuer: cert.issuer },
      });
    }
    if (alreadyHeld.length) {
      this.events.emit(sessionId, 'assumed_defaults', { held_certifications: alreadyHeld });
    }
  }
}
