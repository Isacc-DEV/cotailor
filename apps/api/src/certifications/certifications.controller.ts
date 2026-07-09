import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CertificationsService } from './certifications.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.guard';

// Signed-in users: search the catalog for the profile form, and flag a cert
// that's missing from the catalog so the manager can add it.
@Controller('certifications')
export class CertificationsController {
  constructor(private readonly certs: CertificationsService) {}

  @Get()
  search(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('subtype') subtype?: string,
  ) {
    return this.certs.search({
      search: search?.trim() || undefined,
      category: category?.trim() || undefined,
      subtype: subtype?.trim() || undefined,
    });
  }

  @Post('requests')
  requestMissing(
    @CurrentUser() user: AuthUser,
    @Body() body: { rawText?: string; issuer?: string; category?: string; subtype?: string },
  ) {
    return this.certs.requestMissing(user, body ?? {});
  }
}
