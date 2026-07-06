import { Controller, Get } from '@nestjs/common';
import { SESSION_STATES, CARD_TYPES } from '@cotailor/shared';
import { Public } from './auth/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'cotailor-api',
      states: SESSION_STATES.length,
      cardTypes: CARD_TYPES.length,
      ts: new Date().toISOString(),
    };
  }
}
