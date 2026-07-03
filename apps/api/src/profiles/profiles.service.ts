import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEV_EMAIL = 'dev@cotailor.local';

// MVP note: real auth (JWT + tenancy) lands in Week 1–2 (design Section 20).
// For now a single dev user owns all profiles so the flow is runnable end-to-end.
@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private devUser() {
    return this.prisma.user.upsert({
      where: { email: DEV_EMAIL },
      update: {},
      create: { email: DEV_EMAIL },
    });
  }

  async create(body: any) {
    const user = await this.devUser();
    return this.prisma.profile.create({
      data: {
        userId: user.id,
        name: body?.name ?? 'Backend Engineer — Node.js',
        category: body?.category ?? 'Software Engineering',
        baseResume: body?.baseResume ?? {},
        domainTags: body?.domainTags ?? [],
        workAuthorization: body?.workAuthorization ?? null,
        subtypes: body?.subtypes ? { create: body.subtypes.map((n: string) => ({ name: n })) } : undefined,
        skills: body?.skills ? { create: body.skills.map((n: string) => ({ name: n })) } : undefined,
      },
      include: { subtypes: true, skills: true },
    });
  }

  async list() {
    const user = await this.devUser();
    return this.prisma.profile.findMany({
      where: { userId: user.id, deletedAt: null },
      include: { subtypes: true, skills: true },
    });
  }

  async get(id: string) {
    const p = await this.prisma.profile.findUnique({
      where: { id },
      include: { subtypes: true, skills: true, certifications: true },
    });
    if (!p) throw new NotFoundException({ error: 'not_found', message: 'Profile not found' });
    return p;
  }
}
