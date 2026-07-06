import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, body: any) {
    return this.prisma.profile.create({
      data: {
        userId,
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

  async list(userId: string) {
    return this.prisma.profile.findMany({
      where: { userId, deletedAt: null },
      include: { subtypes: true, skills: true },
    });
  }

  async get(userId: string, id: string) {
    const p = await this.prisma.profile.findUnique({
      where: { id },
      include: { subtypes: true, skills: true, certifications: true },
    });
    // 404 (not 403) for other users' profiles — don't leak that the id exists.
    if (!p || p.userId !== userId) {
      throw new NotFoundException({ error: 'not_found', message: 'Profile not found' });
    }
    return p;
  }

  async update(userId: string, id: string, body: any) {
    const existing = await this.prisma.profile.findUnique({
      where: { id },
      include: { subtypes: true, skills: true },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException({ error: 'not_found', message: 'Profile not found' });
    }

    try {
      const updatePayload: any = {};

      // Real Profile columns
      if (typeof body.name === 'string') updatePayload.name = body.name;
      if (typeof body.category === 'string') updatePayload.category = body.category;
      if (typeof body.workAuthorization === 'string' || body.workAuthorization === null) {
        updatePayload.workAuthorization = body.workAuthorization;
      }
      if (Array.isArray(body.domainTags)) {
        updatePayload.domainTags = body.domainTags;
      }

      // Everything else lives inside the baseResume JSON blob.
      // (Profile has no `header`, `resumeStyle`, `workExperience`, etc. columns.)
      const currentBase =
        typeof existing.baseResume === 'object' && existing.baseResume !== null
          ? (existing.baseResume as any)
          : {};
      const mergedBase = { ...currentBase };

      if (body.baseResume !== undefined && typeof body.baseResume === 'object') {
        Object.assign(mergedBase, body.baseResume);
      }
      if (body.header !== undefined) mergedBase.header = body.header;
      if (body.resumeStyle !== undefined) mergedBase.resumeStyle = body.resumeStyle;
      if (body.subtype !== undefined) mergedBase.subtype = body.subtype;
      if (body.workExperience !== undefined) mergedBase.workExperience = body.workExperience;
      if (body.education !== undefined) mergedBase.education = body.education;
      if (body.certifications !== undefined) mergedBase.certifications = body.certifications;
      if (body.skills !== undefined) mergedBase.skills = body.skills;
      if (body.topSkills !== undefined) mergedBase.topSkills = body.topSkills;

      updatePayload.baseResume = mergedBase;

      // Sync the subtypes relation (used for querying) from the single subtype value.
      if (body.subtype !== undefined) {
        await this.prisma.profileSubtype.deleteMany({ where: { profileId: id } });
        if (body.subtype) {
          await this.prisma.profileSubtype.create({
            data: { profileId: id, name: body.subtype },
          });
        }
      }

      // Sync the skills relation (used for querying) from the skills array.
      if (body.skills !== undefined && Array.isArray(body.skills)) {
        await this.prisma.profileSkill.deleteMany({ where: { profileId: id } });
        for (const skillName of body.skills) {
          if (typeof skillName === 'string' && skillName.trim()) {
            await this.prisma.profileSkill.create({
              data: { profileId: id, name: skillName.trim() },
            });
          }
        }
      }

      const result = await this.prisma.profile.update({
        where: { id },
        data: updatePayload,
        include: { subtypes: true, skills: true, certifications: true },
      });

      return result;
    } catch (error) {
      console.error('Profile update failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async delete(userId: string, id: string) {
    const p = await this.prisma.profile.findUnique({ where: { id } });
    if (!p || p.userId !== userId) {
      throw new NotFoundException({ error: 'not_found', message: 'Profile not found' });
    }

    return this.prisma.profile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
