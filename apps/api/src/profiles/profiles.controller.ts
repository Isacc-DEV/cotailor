import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
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

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.profiles.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.profiles.delete(id);
  }
}
