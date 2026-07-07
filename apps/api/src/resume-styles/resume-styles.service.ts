import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { styleConfigSchema, type StyleConfig } from '@cotailor/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.guard';

const KEY_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

export interface StylePatch {
  name?: string;
  description?: string | null;
  config?: unknown;
  enabled?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

@Injectable()
export class ResumeStylesService {
  constructor(private readonly prisma: PrismaService) {}

  // What the profile form and resume preview consume: enabled styles only.
  async listPublic() {
    const styles = await this.prisma.resumeVisualStyle.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
    });
    return styles.map((s) => ({
      key: s.key,
      name: s.name,
      description: s.description,
      isDefault: s.isDefault,
      config: styleConfigSchema.parse(s.config),
    }));
  }

  async listAdmin() {
    const styles = await this.prisma.resumeVisualStyle.findMany({ orderBy: { sortOrder: 'asc' } });
    // Usage = live profiles whose baseResume.resumeStyle is this key.
    const withUsage = await Promise.all(
      styles.map(async (s) => ({
        id: s.id,
        key: s.key,
        name: s.name,
        description: s.description,
        config: styleConfigSchema.parse(s.config),
        enabled: s.enabled,
        isDefault: s.isDefault,
        sortOrder: s.sortOrder,
        updatedAt: s.updatedAt,
        usageCount: await this.prisma.profile.count({
          where: { deletedAt: null, baseResume: { path: ['resumeStyle'], equals: s.key } },
        }),
      })),
    );
    return withUsage;
  }

  async create(
    actor: AuthUser,
    body: { key?: string; name?: string; description?: string; config?: unknown; isDefault?: boolean; sortOrder?: number },
  ) {
    const key = (body.key ?? '').trim().toLowerCase();
    const name = (body.name ?? '').trim();
    if (!KEY_RE.test(key)) {
      throw new BadRequestException({
        error: 'invalid_key',
        message: 'Key must be 2-32 chars: lowercase letters, digits, hyphens.',
      });
    }
    if (!name) throw new BadRequestException({ error: 'invalid_name', message: 'Name is required.' });

    const existing = await this.prisma.resumeVisualStyle.findUnique({ where: { key } });
    if (existing) {
      throw new ConflictException({ error: 'key_exists', message: `A style with key "${key}" already exists.` });
    }

    const config = styleConfigSchema.parse(body.config ?? {});
    const style = await this.prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.resumeVisualStyle.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.resumeVisualStyle.create({
        data: {
          key,
          name,
          description: body.description?.trim() || null,
          config,
          isDefault: body.isDefault === true,
          sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 100,
        },
      });
    });
    await this.audit(actor, 'admin.style.create', { key, name });
    return style;
  }

  async update(actor: AuthUser, id: string, patch: StylePatch) {
    const style = await this.prisma.resumeVisualStyle.findUnique({ where: { id } });
    if (!style) throw new NotFoundException({ error: 'not_found', message: 'Style not found.' });

    // The default style is the fallback for every unknown/disabled key — it
    // must stay enabled. Make another style the default first.
    if (patch.enabled === false && (style.isDefault || patch.isDefault === true)) {
      throw new BadRequestException({
        error: 'default_must_be_enabled',
        message: 'The default style cannot be disabled. Set another style as default first.',
      });
    }
    if (patch.isDefault === false && style.isDefault) {
      throw new BadRequestException({
        error: 'no_default',
        message: 'There must always be a default style. Set another style as default instead.',
      });
    }

    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!name) throw new BadRequestException({ error: 'invalid_name', message: 'Name is required.' });
      data.name = name;
    }
    if (patch.description !== undefined) data.description = patch.description?.toString().trim() || null;
    if (patch.config !== undefined) data.config = styleConfigSchema.parse(patch.config) as StyleConfig;
    if (patch.enabled !== undefined) data.enabled = patch.enabled === true;
    if (patch.sortOrder !== undefined && typeof patch.sortOrder === 'number') data.sortOrder = patch.sortOrder;
    if (patch.isDefault === true && !style.isDefault) {
      data.isDefault = true;
      data.enabled = true;
    }

    if (Object.keys(data).length === 0) return style;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.resumeVisualStyle.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.resumeVisualStyle.update({ where: { id }, data });
    });
    await this.audit(actor, 'admin.style.update', { key: style.key, fields: Object.keys(data) });
    return updated;
  }

  async delete(actor: AuthUser, id: string) {
    const style = await this.prisma.resumeVisualStyle.findUnique({ where: { id } });
    if (!style) throw new NotFoundException({ error: 'not_found', message: 'Style not found.' });
    if (style.isDefault) {
      throw new BadRequestException({
        error: 'default_style',
        message: 'The default style cannot be deleted. Set another style as default first.',
      });
    }
    const usage = await this.prisma.profile.count({
      where: { deletedAt: null, baseResume: { path: ['resumeStyle'], equals: style.key } },
    });
    if (usage > 0) {
      throw new BadRequestException({
        error: 'style_in_use',
        message: `${usage} profile${usage === 1 ? '' : 's'} use this style. Disable it instead of deleting.`,
      });
    }
    await this.prisma.resumeVisualStyle.delete({ where: { id } });
    await this.audit(actor, 'admin.style.delete', { key: style.key });
    return { deleted: true };
  }

  // Style events have no target user; logged against the acting admin.
  private audit(actor: AuthUser, eventType: string, payload: Record<string, unknown>) {
    return this.prisma.auditLog.create({
      data: { userId: actor.userId, eventType, payload: { ...payload, actorEmail: actor.email } },
    });
  }
}
