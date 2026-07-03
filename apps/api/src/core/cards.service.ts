import { Injectable } from '@nestjs/common';
import type { CardSeverity, CardType, Provenance } from '@cotailor/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';

// CRUD for decision cards (design Section 7). Answer orchestration lives in SessionsService.
@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async create(
    sessionId: string,
    cardType: CardType,
    severity: CardSeverity,
    payload: Record<string, unknown>,
  ) {
    const card = await this.prisma.decisionCard.create({
      data: {
        sessionId,
        cardType: cardType as never,
        severity: severity as never,
        status: 'pending',
        payload: payload as never,
      },
    });
    this.events.emit(sessionId, 'card_created', { cardId: card.id, cardType });
    return card;
  }

  listBySession(sessionId: string) {
    return this.prisma.decisionCard.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  getOrThrow(cardId: string) {
    return this.prisma.decisionCard.findUniqueOrThrow({ where: { id: cardId } });
  }

  async markAnswered(
    cardId: string,
    sessionId: string,
    optionId: string,
    note?: string,
    provenance?: Provenance,
  ) {
    await this.prisma.$transaction([
      this.prisma.decisionCard.update({ where: { id: cardId }, data: { status: 'answered' } }),
      this.prisma.userDecision.create({
        data: {
          cardId,
          sessionId,
          optionId,
          note: note ?? null,
          resolvedProvenance: (provenance as never) ?? null,
        },
      }),
    ]);
    this.events.emit(sessionId, 'card_answered', { cardId, optionId });
  }
}
