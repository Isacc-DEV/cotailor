import { Global, Module } from '@nestjs/common';
import { SessionStateService } from './session-state.service';
import { SessionTransitionService } from './session-transition.service';
import { EventsService } from './events.service';
import { GatesService } from './gates.service';
import { CardsService } from './cards.service';

// Cross-cutting backend services, available everywhere.
@Global()
@Module({
  providers: [SessionStateService, SessionTransitionService, EventsService, GatesService, CardsService],
  exports: [SessionStateService, SessionTransitionService, EventsService, GatesService, CardsService],
})
export class CoreModule {}
