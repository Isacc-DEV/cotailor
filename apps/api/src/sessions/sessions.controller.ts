import { Body, Controller, Delete, Get, HttpCode, MessageEvent, Param, Post, Put, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { SessionsService } from './sessions.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.guard';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: { profile_id: string }) {
    return this.sessions.create(user.userId, body.profile_id);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.sessions.list(user.userId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.getOwned(user.userId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.remove(user.userId, id);
  }

  @Post(':id/jd')
  @HttpCode(202)
  submitJd(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { text: string }) {
    return this.sessions.submitJd(user.userId, id, body.text);
  }

  @Get(':id/cards')
  cards(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.listCards(user.userId, id);
  }

  @Get(':id/strategy')
  strategy(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.getStrategy(user.userId, id);
  }

  @Get(':id/resume')
  resume(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.getResume(user.userId, id);
  }

  @Put(':id/resume')
  saveResume(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.sessions.saveResume(user.userId, id, body);
  }

  @Post(':id/resume/fix-bullet')
  fixBullet(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { text: string; instruction: string; avoid_openers?: string[] },
  ) {
    return this.sessions.fixBullet(user.userId, id, body.text, body.instruction, body.avoid_openers ?? []);
  }

  @Post(':id/cards/:cardId/answer')
  answer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('cardId') cardId: string,
    @Body() body: { option_id: string; note?: string },
  ) {
    return this.sessions.answerCard(user.userId, id, cardId, body.option_id, body.note);
  }

  @Sse(':id/events')
  events(@CurrentUser() user: AuthUser, @Param('id') id: string): Observable<MessageEvent> {
    return this.sessions.stream(user.userId, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.cancel(user.userId, id);
  }

  @Post(':id/generate')
  generate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.generate(user.userId, id);
  }
}
