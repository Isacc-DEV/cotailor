import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { JD_CHAR_CAP } from '@cotailor/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SessionTransitionService } from '../core/session-transition.service';
import { CardsService } from '../core/cards.service';
import { EventsService } from '../core/events.service';
import { LLM_PROVIDER, type LLMProvider } from '../llm/llm-provider.interface';
import { AnalysisService } from '../analysis/analysis.service';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transitions: SessionTransitionService,
    private readonly cards: CardsService,
    private readonly events: EventsService,
    private readonly analysis: AnalysisService,
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
  ) {}

  async create(profileId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException({ error: 'not_found', message: 'Profile not found' });
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

  async get(id: string) {
    const s = await this.prisma.tailoringSession.findUnique({ where: { id }, include: { cards: true } });
    if (!s) throw new NotFoundException({ error: 'not_found', message: 'Session not found' });
    return s;
  }

  cancel(id: string) {
    return this.transitions.apply(id, 'CANCEL', 'SESSION_CANCELLED');
  }

  // APPROVE_STRATEGY is illegal before STRATEGY_REVIEW → 409 with allowed_actions.
  generate(id: string) {
    return this.transitions.apply(id, 'APPROVE_STRATEGY', 'GENERATE_REQUESTED');
  }

  async submitJd(id: string, text: string) {
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
    void this.analysis.run(id).catch((e: unknown) => {
      this.events.emit(id, 'error', { message: e instanceof Error ? e.message : String(e) });
    });

    return this.get(id);
  }

  listCards(id: string) {
    return this.cards.listBySession(id);
  }

  async answerCard(sessionId: string, cardId: string, optionId: string, note?: string) {
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
          void this.analysis.run(sessionId, { trustCategory: true, confirmedCategory: corrected }).catch((e: unknown) => {
            this.events.emit(sessionId, 'error', { message: e instanceof Error ? e.message : String(e) });
          });
        }
        break;

      case 'knockout_requirement':
        if (optionId === 'cancel') {
          await this.cards.markAnswered(cardId, sessionId, optionId, note);
          await this.transitions.apply(sessionId, 'CANCEL', 'SESSION_CANCELLED');
        } else {
          await this.cards.markAnswered(
            cardId,
            sessionId,
            optionId,
            note,
            optionId === 'meet' ? 'user_confirmed' : undefined,
          );
        }
        break;

      default:
        await this.cards.markAnswered(cardId, sessionId, optionId, note);
    }
    return this.get(sessionId);
  }

  stream(id: string) {
    return this.events.stream(id);
  }
}
