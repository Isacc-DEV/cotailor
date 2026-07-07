import { Controller, Get } from '@nestjs/common';
import { ResumeStylesService } from './resume-styles.service';

// Read-only list for the profile form and resume preview (any signed-in user).
@Controller('resume-styles')
export class ResumeStylesController {
  constructor(private readonly styles: ResumeStylesService) {}

  @Get()
  list() {
    return this.styles.listPublic();
  }
}
