import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminUsersService, type UserPatch } from './admin-users.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.guard';

// All routes: JwtAuthGuard (global) first, then AdminGuard's fresh DB check.
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly users: AdminUsersService) {}

  @Get('stats')
  stats() {
    return this.users.stats();
  }

  @Get('users')
  listUsers(
    @Query('search') search?: string,
    @Query('role') role?: 'user' | 'admin',
    @Query('status') status?: 'pending' | 'active' | 'suspended',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.users.list({
      search: search?.trim() || undefined,
      role: role === 'admin' || role === 'user' ? role : undefined,
      status: status === 'pending' || status === 'active' || status === 'suspended' ? status : undefined,
      page: page ? Number(page) || 1 : undefined,
      pageSize: pageSize ? Number(pageSize) || 20 : undefined,
    });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Patch('users/:id')
  updateUser(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: UserPatch) {
    return this.users.update(actor, id, {
      role: body.role === 'admin' || body.role === 'user' ? body.role : undefined,
      status: body.status === 'active' || body.status === 'suspended' ? body.status : undefined,
    });
  }
}
