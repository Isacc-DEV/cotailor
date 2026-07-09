import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { CertificationsModule } from '../certifications/certifications.module';

@Module({
  imports: [CertificationsModule],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
