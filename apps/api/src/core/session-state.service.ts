import { ConflictException, Injectable } from '@nestjs/common';
import { allowedActions, nextState, type SessionEvent, type SessionState } from '@cotailor/shared';

@Injectable()
export class SessionStateService {
  // Returns the next state, or throws HTTP 409 with the actions that ARE allowed now.
  next(current: SessionState, event: SessionEvent): SessionState {
    const to = nextState(current, event);
    if (!to) {
      throw new ConflictException({
        error: 'invalid_state',
        message: `Action '${event}' is not allowed while the session is ${current}.`,
        current_state: current,
        allowed_actions: allowedActions(current),
      });
    }
    return to;
  }
}
