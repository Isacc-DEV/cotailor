import { Module } from '@nestjs/common';
import { ProfileImportController } from './profile-import.controller';
import { ProfileImportService } from './profile-import.service';
import { DocumentExtractService } from './document-extract.service';

@Module({
  controllers: [ProfileImportController],
  providers: [ProfileImportService, DocumentExtractService],
})
export class ProfileImportModule {}
