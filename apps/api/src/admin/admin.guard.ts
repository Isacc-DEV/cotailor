import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.guard';

// Runs after the global JwtAuthGuard. Re-checks role and suspension against the
// DB on every admin request — a demoted or suspended admin loses access
// immediately, not when their 7-day token expires. Admin traffic is tiny, so
// the extra query is a non-issue.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException({ error: 'forbidden', message: 'Admin access required.' });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    if (!user || user.status !== 'active' || user.role !== 'admin') {
      throw new ForbiddenException({ error: 'forbidden', message: 'Admin access required.' });
    }
    return true;
  }
}
