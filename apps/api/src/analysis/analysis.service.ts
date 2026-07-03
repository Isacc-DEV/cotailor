import { Inject, Injectable, Logger } from '@nestjs/common';
import type { JdAnalysis, SkillExtraction } from '@cotailor/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LLM_PROVIDER, type LLMProvider } from '../llm/llm-provider.interface';
import { GatesService } from '../core/gates.service';
import { CardsService } from '../core/cards.service';
import { SessionTransitionService } from '../core/session-transition.service';
import { EventsService } from '../core/events.service';

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
  ) {}

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
      const raw = analysisRow.raw as { analysis: JdAnalysis; extraction: SkillExtraction };
      analysis = raw.analysis;
      extraction = raw.extraction;
    } else {
      analysis = await this.llm.analyzeJD(jdText);
      extraction = await this.llm.extractSkills(jdText);
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

    // Subtype matched → open the board and evaluate knockout requirements.
    await this.transitions.apply(sessionId, 'ANALYSIS_NEEDS_CARDS', 'ANALYSIS_TO_BOARD');
    await this.evaluatePostSubtype(sessionId);
  }

  // Knockout cards, evaluated once the subtype gate is cleared.
  async evaluatePostSubtype(sessionId: string): Promise<void> {
    const session = await this.prisma.tailoringSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { profile: true },
    });
    const analysisRow = await this.prisma.jdAnalysis.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    if (!analysisRow) return;
    const raw = analysisRow.raw as { analysis: JdAnalysis; extraction: SkillExtraction };
    const extraction = raw.extraction;

    const unresolved = this.gates.unresolvedKnockouts(
      { workAuthorization: session.profile.workAuthorization },
      extraction,
    );
    for (const k of unresolved) {
      await this.cards.create(sessionId, 'knockout_requirement', 'critical', {
        card_type: 'knockout_requirement',
        title: `Requirement: ${k.value}`,
        message: `The JD requires "${k.value}", which isn't confirmed on your profile.`,
        options: [
          { option_id: 'meet', label: 'I meet this requirement', consequence: 'Recorded as confirmed.' },
          { option_id: 'dont_meet', label: "I don't meet it — continue anyway", consequence: 'Logged; the report raises the risk level.' },
          { option_id: 'cancel', label: 'Cancel', consequence: 'Ends this session.' },
        ],
        recommended_option: null,
        severity: 'critical',
        context: { type: k.type, value: k.value, evidence_quote: k.evidence_quote },
      });
    }

    this.events.emit(sessionId, 'cards_ready', { state: 'WAITING_SKILL_DECISIONS' });
  }
}
