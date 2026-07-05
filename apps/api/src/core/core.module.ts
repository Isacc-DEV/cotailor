import { Global, Module } from '@nestjs/common';
import { SessionStateService } from './session-state.service';
import { SessionTransitionService } from './session-transition.service';
import { EventsService } from './events.service';
import { GatesService } from './gates.service';
import { CardsService } from './cards.service';
import { ResumeBuilderService } from './resume-builder.service';

// Cross-cutting backend services, available everywhere.
@Global()
@Module({
  providers: [
    SessionStateService,
    SessionTransitionService,
    EventsService,
    GatesService,
    CardsService,
    ResumeBuilderService,
  ],
  exports: [
    SessionStateService,
    SessionTransitionService,
    EventsService,
    GatesService,
    CardsService,
    ResumeBuilderService,
  ],
})
export class CoreModule {}
