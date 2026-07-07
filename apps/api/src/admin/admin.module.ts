import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminGuard } from './admin.guard';

@Module({
  controllers: [AdminController],
  providers: [AdminUsersService, AdminGuard],
})
export class AdminModule {}
