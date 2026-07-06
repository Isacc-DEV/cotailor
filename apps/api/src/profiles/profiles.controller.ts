import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.guard';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.profiles.create(user.userId, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.profiles.list(user.userId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.profiles.get(user.userId, id);
  }

  @Put(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.profiles.update(user.userId, id, body);
  }

  @Delete(':id')
  delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.profiles.delete(user.userId, id);
  }
}
