import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { ResumeStylesService, type StylePatch } from './resume-styles.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.guard';

@Controller('admin/resume-styles')
@UseGuards(AdminGuard)
export class AdminResumeStylesController {
  constructor(private readonly styles: ResumeStylesService) {}

  @Get()
  list() {
    return this.styles.listAdmin();
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() body: any) {
    return this.styles.create(actor, body ?? {});
  }

  @Patch(':id')
  update(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: StylePatch) {
    return this.styles.update(actor, id, body ?? {});
  }

  @Delete(':id')
  delete(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.styles.delete(actor, id);
  }
}
