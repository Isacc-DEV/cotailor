import { Body, Controller, Get, HttpCode, MessageEvent, Param, Post, Put, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  create(@Body() body: { profile_id: string }) {
    return this.sessions.create(body.profile_id);
  }

  @Get()
  list() {
    return this.sessions.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.sessions.get(id);
  }

  @Post(':id/jd')
  @HttpCode(202)
  submitJd(@Param('id') id: string, @Body() body: { text: string }) {
    return this.sessions.submitJd(id, body.text);
  }

  @Get(':id/cards')
  cards(@Param('id') id: string) {
    return this.sessions.listCards(id);
  }

  @Get(':id/strategy')
  strategy(@Param('id') id: string) {
    return this.sessions.getStrategy(id);
  }

  @Get(':id/resume')
  resume(@Param('id') id: string) {
    return this.sessions.getResume(id);
  }

  @Put(':id/resume')
  saveResume(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.sessions.saveResume(id, body);
  }

  @Post(':id/resume/fix-bullet')
  fixBullet(
    @Param('id') id: string,
    @Body() body: { text: string; instruction: string; avoid_openers?: string[] },
  ) {
    return this.sessions.fixBullet(id, body.text, body.instruction, body.avoid_openers ?? []);
  }

  @Post(':id/cards/:cardId/answer')
  answer(
    @Param('id') id: string,
    @Param('cardId') cardId: string,
    @Body() body: { option_id: string; note?: string },
  ) {
    return this.sessions.answerCard(id, cardId, body.option_id, body.note);
  }

  @Sse(':id/events')
  events(@Param('id') id: string): Observable<MessageEvent> {
    return this.sessions.stream(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.sessions.cancel(id);
  }

  @Post(':id/generate')
  generate(@Param('id') id: string) {
    return this.sessions.generate(id);
  }
}
