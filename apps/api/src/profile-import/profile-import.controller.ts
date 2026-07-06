import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileImportService } from './profile-import.service';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller('profiles')
export class ProfileImportController {
  constructor(private readonly service: ProfileImportService) {}

  // Multipart upload of a .docx/.pdf resume; returns a profile draft for the
  // form, never a persisted profile. Memory storage (multer default) — the
  // file exists only for the duration of this request.
  @Post('import-resume')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  importResume(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file received — upload a .docx or .pdf resume as the "file" field.');
    }
    return this.service.importResume(file.buffer, file.originalname ?? 'resume');
  }
}
