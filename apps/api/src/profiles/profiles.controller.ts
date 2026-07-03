import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Post()
  create(@Body() body: any) {
    return this.profiles.create(body);
  }

  @Get()
  list() {
    return this.profiles.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.profiles.get(id);
  }
}
