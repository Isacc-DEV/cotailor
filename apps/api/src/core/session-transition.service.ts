import { Injectable } from '@nestjs/common';
import type { SessionEvent, SessionState } from '@cotailor/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SessionStateService } from './session-state.service';
import { EventsService } from './events.service';

// The single place a session changes state: guarded, transactional, audited, and broadcast.
@Injectable()
export class SessionTransitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateSvc: SessionStateService,
    private readonly events: EventsService,
  ) {}

  async apply(sessionId: string, event: SessionEvent, eventType: string, payload?: unknown) {
    const session = await this.prisma.tailoringSession.findUniqueOrThrow({ where: { id: sessionId } });
    const from = session.state as SessionState;
    const to = this.stateSvc.next(from, event); // throws 409 if illegal
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.tailoringSession.update({ where: { id: sessionId }, data: { state: to as never } });
      await tx.auditLog.create({
        data: {
          sessionId,
          userId: session.userId,
          eventType,
          fromState: from as never,
          toState: to as never,
          payload: (payload as never) ?? undefined,
        },
      });
      return u;
    });
    this.events.emit(sessionId, 'state_changed', { from, to, event: eventType });
    return updated;
  }
}
