import { Inject, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { createHash } from 'node:crypto';
import { JD_CHAR_CAP } from '@cotailor/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SessionTransitionService } from '../core/session-transition.service';
import { CardsService } from '../core/cards.service';
import { EventsService } from '../core/events.service';
import { ResumeBuilderService } from '../core/resume-builder.service';
import { BUZZWORDS, WEAK_PHRASES, lintResume } from '../core/resume-quality';
import { LLM_PROVIDER, type LLMProvider } from '../llm/llm-provider.interface';
import { AnalysisService } from '../analysis/analysis.service';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transitions: SessionTransitionService,
    private readonly cards: CardsService,
    private readonly events: EventsService,
    private readonly analysis: AnalysisService,
    private readonly resumeBuilder: ResumeBuilderService,
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
  ) {}

  // 404 (not 403) when the session belongs to someone else — don't leak that the id exists.
  private async assertOwned(userId: string, id: string): Promise<void> {
    const s = await this.prisma.tailoringSession.findUnique({ where: { id }, select: { userId: true } });
    if (!s || s.userId !== userId) {
      throw new NotFoundException({ error: 'not_found', message: 'Session not found' });
    }
  }

  async create(userId: string, profileId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile || profile.userId !== userId) {
      throw new NotFoundException({ error: 'not_found', message: 'Profile not found' });
    }
    const session = await this.prisma.tailoringSession.create({
      data: {
        userId: profile.userId,
        profileId: profile.id,
        state: 'CREATED',
        profileSnapshot: (profile.baseResume as object) ?? {},
      },
    });
    await this.prisma.auditLog.create({
      data: { sessionId: session.id, userId: profile.userId, eventType: 'SESSION_CREATED', toState: 'CREATED' as never },
    });
    return session;
  }

  // Internal fetch — ownership is asserted at the controller-facing entry points.
  async get(id: string) {
    const s = await this.prisma.tailoringSession.findUnique({ where: { id }, include: { cards: true } });
    if (!s) throw new NotFoundException({ error: 'not_found', message: 'Session not found' });

    // Analysis runs fire-and-forget, so a provider failure leaves the session
    // parked in ANALYZING with pollers spinning. Surface the recorded failure —
    // unless a later event restarted analysis, which supersedes it.
    if (s.state === 'JD_SUBMITTED' || s.state === 'ANALYZING') {
      const latest = await this.prisma.auditLog.findFirst({
        where: {
          sessionId: id,
          eventType: { in: ['ANALYSIS_FAILED', 'ANALYSIS_STARTED', 'CATEGORY_CONFIRMED', 'SUBTYPE_CONFIRMED'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (latest?.eventType === 'ANALYSIS_FAILED') {
        const message = (latest.payload as { message?: string } | null)?.message;
        return { ...s, analysisError: message || 'Analysis failed unexpectedly.' };
      }
    }
    return s;
  }

  // Analysis failures must outlive the request: log, broadcast (SSE), and
  // persist to the audit log so session polling can report what went wrong.
  private async recordAnalysisFailure(sessionId: string, e: unknown): Promise<void> {
    const message = e instanceof Error ? e.message : String(e);
    this.logger.error(`analysis.run failed for session ${sessionId}: ${message}`, e instanceof Error ? e.stack : undefined);
    this.events.emit(sessionId, 'error', { message });
    await this.prisma.auditLog
      .create({ data: { sessionId, eventType: 'ANALYSIS_FAILED', payload: { message } as never } })
      .catch(() => undefined);
  }

  async getOwned(userId: string, id: string) {
    await this.assertOwned(userId, id);
    return this.get(id);
  }

  // Session history: newest first, with just enough joined data for the list
  // views (profile name, JD first line, detected role, card progress).
  async list(userId: string) {
    const sessions = await this.prisma.tailoringSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        profile: { select: { name: true } },
        jdDocument: { select: { text: true } },
        analyses: { orderBy: { createdAt: 'desc' }, take: 1, select: { subtype: true, category: true } },
        cards: { select: { status: true } },
      },
    });
    return sessions.map((s) => ({
      id: s.id,
      state: s.state,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      jdDocumentId: s.jdDocumentId,
      profileId: s.profileId,
      profile: s.profile ? { name: s.profile.name } : null,
      // Only the first line is needed by the UI — don't ship whole JDs.
      jdDocument: s.jdDocument ? { text: s.jdDocument.text.slice(0, 200) } : null,
      jobTitle: s.analyses[0]?.subtype ?? null,
      category: s.analyses[0]?.category ?? null,
      cardsTotal: s.cards.length,
      cardsAnswered: s.cards.filter((c) => c.status !== 'pending').length,
    }));
  }

  async cancel(userId: string, id: string) {
    await this.assertOwned(userId, id);
    return this.transitions.apply(id, 'CANCEL', 'SESSION_CANCELLED');
  }

  // APPROVE_STRATEGY is illegal before STRATEGY_REVIEW → 409 with allowed_actions.
  // Drives the full generation path: build the tailored resume (per-bullet
  // edits), persist it as a ResumeVersion, then validate → FINAL_READY.
  async generate(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.transitions.apply(id, 'APPROVE_STRATEGY', 'GENERATE_REQUESTED');
    const built = await this.resumeBuilder.build(id);
    await this.saveResumeVersion(id, built, 'ai_generation');
    await this.transitions.apply(id, 'GENERATION_READY', 'GENERATION_COMPLETE');
    const validation = await this.llm.validateResume({});
    if (validation.passed) {
      await this.transitions.apply(id, 'VALIDATION_PASSED', 'VALIDATION_PASSED');
    } else {
      await this.transitions.apply(id, 'VALIDATION_FAILED_FINAL', 'VALIDATION_FAILED');
    }
    return this.get(id);
  }

  // Persist resume content as a new ResumeVersion and point the session at it.
  // qualityReport is derived, not stored — it's re-linted on every read.
  private async saveResumeVersion(
    sessionId: string,
    content: object,
    createdBy: 'ai_generation' | 'ai_revision' | 'user_edit',
  ) {
    const { qualityReport: _drop, ...toStore } = content as any;
    const last = await this.prisma.resumeVersion.findFirst({
      where: { sessionId },
      orderBy: { versionNo: 'desc' },
    });
    const version = await this.prisma.resumeVersion.create({
      data: {
        sessionId,
        versionNo: (last?.versionNo ?? 0) + 1,
        contentJson: toStore as never,
        createdBy: createdBy as never,
      },
    });
    await this.prisma.tailoringSession.update({
      where: { id: sessionId },
      data: { activeVersionId: version.id },
    });
    return version;
  }

  // A light strategy view derived from the answered decisions (no Strategy table).
  async getStrategy(userId: string, id: string) {
    await this.assertOwned(userId, id);
    const session = await this.get(id);
    const decisions = await this.prisma.userDecision.findMany({ where: { sessionId: id } });
    const cards = await this.cards.listBySession(id);
    const optionByCard = new Map(decisions.map((d) => [d.cardId, d.optionId]));
    const plan = cards
      .map((c) => {
        const ctx = ((c.payload ?? {}) as any).context ?? {};
        return {
          card_type: c.cardType,
          skill: ctx.jd_skill ?? ctx.certification ?? ctx.value,
          decision: optionByCard.get(c.id) ?? null,
        };
      })
      .filter((p) => p.decision);
    return { state: session.state, plan };
  }

  // The tailored resume: the stored active version (so user edits persist),
  // built + persisted on first read for sessions generated before versioning.
  // The quality report is always re-linted fresh.
  async getResume(userId: string, id: string) {
    await this.assertOwned(userId, id);
    const session = await this.get(id);

    let version = session.activeVersionId
      ? await this.prisma.resumeVersion.findUnique({ where: { id: session.activeVersionId } })
      : null;
    if (!version) {
      version = await this.prisma.resumeVersion.findFirst({
        where: { sessionId: id },
        orderBy: { versionNo: 'desc' },
      });
    }

    let content: any;
    if (version) {
      content = version.contentJson;
    } else {
      const built = await this.resumeBuilder.build(id);
      await this.saveResumeVersion(id, built, 'ai_generation');
      const { qualityReport: _drop, ...rest } = built as any;
      content = rest;
    }

    return {
      ...content,
      qualityReport: lintResume(content.workExperience ?? [], content.summary),
    };
  }

  // Save user edits as a new version (full content replace, versioned).
  async saveResume(userId: string, id: string, content: Record<string, unknown>) {
    if (!content || typeof content !== 'object' || !Array.isArray((content as any).workExperience)) {
      throw new UnprocessableEntityException({
        error: 'invalid_resume',
        message: 'Resume content with a workExperience array is required.',
      });
    }
    await this.assertOwned(userId, id);
    await this.saveResumeVersion(id, content, 'user_edit');
    const { qualityReport: _drop, ...rest } = content as any;
    return { ...rest, qualityReport: lintResume(rest.workExperience ?? [], rest.summary) };
  }

  // One-bullet style fix (buzzwords, repeated openers). The caller shows the
  // suggestion for approval — nothing is saved here.
  //
  // The rewrite is CONSTRAINED (must not start with any word in avoidOpeners,
  // must not use clichés/weak phrases) and then VERIFIED; on violation we retry
  // with explicit feedback so the fix can't just introduce a new problem.
  async fixBullet(userId: string, id: string, text: string, instruction: string, avoidOpeners: string[] = []) {
    if (!text?.trim()) {
      throw new UnprocessableEntityException({ error: 'invalid_bullet', message: 'Bullet text is required.' });
    }
    await this.assertOwned(userId, id);

    const avoid = avoidOpeners.map((w) => w.trim().toLowerCase()).filter(Boolean);
    const constraints = [
      avoid.length > 0
        ? `The rewritten bullet must NOT begin with any of these words (other bullets already start with them): ${avoid.join(', ')}.`
        : '',
      `Never use these clichés: ${BUZZWORDS.join(', ')}.`,
      `Never use these weak phrases: ${WEAK_PHRASES.join(', ')}.`,
      'Start with a strong action verb not in the forbidden list.',
    ]
      .filter(Boolean)
      .join(' ');

    // What makes a suggestion unacceptable — mirrors the linter.
    const violation = (t: string): string | null => {
      const lower = t.toLowerCase();
      const opener = (t.trim().split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
      if (opener && avoid.includes(opener)) return `it starts with the forbidden word "${opener}"`;
      const buzz = BUZZWORDS.find((b) => lower.includes(b));
      if (buzz) return `it contains the cliché "${buzz}"`;
      const weak = WEAK_PHRASES.find((w) => lower.includes(w));
      if (weak) return `it contains the weak phrase "${weak}"`;
      return null;
    };

    const MAX_ATTEMPTS = 3;
    let feedback = '';
    let last = text;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { text: suggestion } = await this.llm.rewriteBullet({
        bullet: text,
        skill: '',
        mode: 'style',
        instruction: `${instruction} ${constraints}${feedback}`,
      });
      const bad = violation(suggestion);
      if (!bad) return { text: suggestion, verified: true };
      last = suggestion;
      feedback = ` Your previous attempt ("${suggestion.slice(0, 80)}") was rejected because ${bad}. Produce a different wording that satisfies every constraint.`;
      this.logger.warn(`fixBullet attempt ${attempt + 1} rejected: ${bad}`);
    }
    // Best effort after retries — flagged so the UI can tell the user to review.
    return { text: last, verified: false };
  }

  async submitJd(userId: string, id: string, text: string) {
    await this.assertOwned(userId, id);
    if (!text || !text.trim()) {
      throw new UnprocessableEntityException({ error: 'unprocessable_jd', message: 'JD text is required.' });
    }
    if (text.length > JD_CHAR_CAP) {
      throw new UnprocessableEntityException({ error: 'unprocessable_jd', message: `JD exceeds ${JD_CHAR_CAP} characters.` });
    }
    // cheap pre-check (fast tier)
    const pre = await this.llm.precheckJD(text);
    if (!pre.is_job_description) {
      throw new UnprocessableEntityException({
        error: 'unprocessable_jd',
        message: 'This text is too short to be a job description — please paste the full posting.',
      });
    }
    if (pre.language && pre.language !== 'en') {
      throw new UnprocessableEntityException({
        error: 'unsupported_language',
        message: `Detected ${pre.language}; MVP supports English only.`,
      });
    }

    const session = await this.get(id); // ensures it exists
    const hash = createHash('sha256').update(text).digest('hex');
    const jd = await this.prisma.jdDocument.upsert({
      where: { contentHash: hash },
      update: {},
      create: { contentHash: hash, text, source: 'paste', userId: session.userId },
    });
    await this.prisma.tailoringSession.update({ where: { id }, data: { jdDocumentId: jd.id } });

    // CREATED → JD_SUBMITTED → ANALYZING (the transition guard enforces the CREATED precondition)
    await this.transitions.apply(id, 'SUBMIT_JD', 'JD_SUBMITTED');
    await this.transitions.apply(id, 'START_ANALYSIS', 'ANALYSIS_STARTED');

    // fire-and-forget analysis job (in-process for now; see AnalysisService)
    void this.analysis.run(id).catch((e: unknown) => this.recordAnalysisFailure(id, e));

    return this.get(id);
  }

  async listCards(userId: string, id: string) {
    await this.assertOwned(userId, id);
    return this.cards.listBySession(id);
  }

  async answerCard(userId: string, sessionId: string, cardId: string, optionId: string, note?: string) {
    await this.assertOwned(userId, sessionId);
    const card = await this.cards.getOrThrow(cardId);
    if (card.sessionId !== sessionId) {
      throw new NotFoundException({ error: 'not_found', message: 'Card not found in this session' });
    }

    switch (card.cardType) {
      case 'subtype_mismatch':
        await this.cards.markAnswered(cardId, sessionId, optionId, note);
        if (optionId === 'proceed') {
          await this.transitions.apply(sessionId, 'SUBTYPE_YES', 'SUBTYPE_CONFIRMED');
          await this.analysis.evaluatePostSubtype(sessionId);
        } else {
          await this.transitions.apply(sessionId, 'SUBTYPE_NO', 'SUBTYPE_DECLINED');
        }
        break;

      case 'category_low_confidence':
        await this.cards.markAnswered(cardId, sessionId, optionId, note);
        if (optionId === 'cancel') {
          await this.transitions.apply(sessionId, 'CANCEL_CATEGORY', 'CATEGORY_CANCELLED');
        } else {
          await this.transitions.apply(sessionId, 'CONFIRM_CATEGORY', 'CATEGORY_CONFIRMED');
          const corrected = optionId === 'correct' ? note : undefined;
          void this.analysis
            .run(sessionId, { trustCategory: true, confirmedCategory: corrected })
            .catch((e: unknown) => this.recordAnalysisFailure(sessionId, e));
        }
        break;

      case 'certification_risk':
        if (optionId === 'cancel') {
          await this.cards.markAnswered(cardId, sessionId, optionId, note);
          await this.transitions.apply(sessionId, 'CANCEL', 'SESSION_CANCELLED');
        } else {
          await this.cards.markAnswered(cardId, sessionId, optionId, note);
        }
        break;

      default:
        await this.cards.markAnswered(cardId, sessionId, optionId, note);
    }

    // Board complete: once the last pending card is answered, move to strategy.
    await this.maybeFinishBoard(sessionId);
    return this.get(sessionId);
  }

  // When no pending cards remain on the board, enqueue the strategy step and
  // advance WAITING_SKILL_DECISIONS → STRATEGY_REVIEW.
  private async maybeFinishBoard(sessionId: string): Promise<void> {
    const session = await this.prisma.tailoringSession.findUnique({ where: { id: sessionId } });
    if (!session || session.state !== 'WAITING_SKILL_DECISIONS') return;

    const cards = await this.cards.listBySession(sessionId);
    const anyPending = cards.some((c) => c.status === 'pending');
    if (anyPending) return;

    await this.transitions.apply(sessionId, 'CARDS_RESOLVED', 'CARDS_RESOLVED');
    await this.transitions.apply(sessionId, 'STRATEGY_READY', 'STRATEGY_READY');
    this.events.emit(sessionId, 'strategy_ready', { state: 'STRATEGY_REVIEW' });
  }

  // @Sse handlers must return an Observable synchronously, so the ownership
  // check runs inside the stream; a failed check errors the SSE connection.
  stream(userId: string, id: string) {
    return from(this.assertOwned(userId, id)).pipe(switchMap(() => this.events.stream(id)));
  }
}
