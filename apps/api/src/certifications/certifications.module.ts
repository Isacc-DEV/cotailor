import { Module } from '@nestjs/common';
import { CertificationsController } from './certifications.controller';
import { AdminCertificationsController } from './admin-certifications.controller';
import { CertificationsService } from './certifications.service';
import { AdminGuard } from '../admin/admin.guard';

@Module({
  controllers: [CertificationsController, AdminCertificationsController],
  providers: [CertificationsService, AdminGuard],
  exports: [CertificationsService],
})
export class CertificationsModule {}
