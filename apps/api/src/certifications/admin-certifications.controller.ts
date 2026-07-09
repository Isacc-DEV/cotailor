import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { CertificationsService, type CertPatch } from './certifications.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.guard';

// JwtAuthGuard (global) first, then AdminGuard's fresh DB check.
@Controller('admin/certifications')
@UseGuards(AdminGuard)
export class AdminCertificationsController {
  constructor(private readonly certs: CertificationsService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('subtype') subtype?: string,
  ) {
    return this.certs.listAdmin({
      search: search?.trim() || undefined,
      category: category?.trim() || undefined,
      subtype: subtype?.trim() || undefined,
    });
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() body: unknown) {
    return this.certs.create(actor, body ?? {});
  }

  @Patch(':id')
  update(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: CertPatch) {
    return this.certs.update(actor, id, body ?? {});
  }

  @Delete(':id')
  remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.certs.remove(actor, id);
  }

  // The manager's to-do list of user-requested certs. Sub-paths (two segments)
  // don't collide with the single-segment :id routes above.
  @Get('todos/list')
  todos(@Query('status') status?: string) {
    return this.certs.listTodos(status?.trim() || 'open');
  }

  @Patch('todos/:id')
  resolveTodo(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: { status?: string }) {
    const status = body?.status === 'dismissed' ? 'dismissed' : 'done';
    return this.certs.resolveTodo(actor, id, status);
  }
}
