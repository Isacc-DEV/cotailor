import { Module } from '@nestjs/common';
import { ResumeStylesController } from './resume-styles.controller';
import { AdminResumeStylesController } from './admin-resume-styles.controller';
import { ResumeStylesService } from './resume-styles.service';
import { AdminGuard } from '../admin/admin.guard';

@Module({
  controllers: [ResumeStylesController, AdminResumeStylesController],
  providers: [ResumeStylesService, AdminGuard],
})
export class ResumeStylesModule {}
