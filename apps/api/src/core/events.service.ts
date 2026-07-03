import { Injectable, type MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface SessionEventMsg {
  sessionId: string;
  event: string;
  data: unknown;
}

// In-process pub/sub for Server-Sent Events (design Section 15). One stream per session.
@Injectable()
export class EventsService {
  private readonly subject = new Subject<SessionEventMsg>();

  emit(sessionId: string, event: string, data: unknown = {}): void {
    this.subject.next({ sessionId, event, data });
  }

  stream(sessionId: string): Observable<MessageEvent> {
    return this.subject.pipe(
      filter((e) => e.sessionId === sessionId),
      map((e) => ({ type: e.event, data: JSON.stringify(e.data) }) as MessageEvent),
    );
  }
}
