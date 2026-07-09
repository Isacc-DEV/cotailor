import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { certificationInputSchema, normCert, type CertificationInput } from '@cotailor/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.guard';

export interface CertPatch {
  name?: string;
  issuer?: string;
  level?: string | null;
  categories?: string[];
  subtypes?: string[];
  aliases?: string[];
  enabled?: boolean;
}

interface CertFilter {
  search?: string;
  category?: string;
  subtype?: string;
}

@Injectable()
export class CertificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Admin: every cert (grouped in the UI by category → subtype), optional filters.
  async listAdmin(filter: CertFilter = {}) {
    const where: Record<string, unknown> = {};
    if (filter.category) where.categories = { has: filter.category };
    if (filter.subtype) where.subtypes = { has: filter.subtype };
    const rows = await this.prisma.certificationCatalog.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    const q = filter.search?.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.issuer.toLowerCase().includes(q) ||
        r.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }

  // Profile-form picker: enabled certs only, searched/filtered, capped.
  async search(filter: CertFilter = {}) {
    const rows = await this.listAdmin(filter);
    return rows.filter((r) => r.enabled).slice(0, 50);
  }

  // JD flow candidate list: enabled certs in this category whose subtypes
  // include the detected subtype. Widens to the whole category when no subtype
  // is given or nothing matches (so a shaky subtype guess never starves the AI).
  async candidatesForJob(category: string, subtype?: string) {
    const inCategory = await this.prisma.certificationCatalog.findMany({
      where: { enabled: true, categories: { has: category } },
      orderBy: { name: 'asc' },
    });
    if (!subtype) return inCategory;
    const sub = subtype.trim().toLowerCase();
    const bySubtype = inCategory.filter((r) => r.subtypes.some((s) => s.toLowerCase() === sub));
    return bySubtype.length ? bySubtype : inCategory;
  }

  async create(actor: AuthUser, body: unknown) {
    const input = this.validate(body);
    const cert = await this.prisma.certificationCatalog.create({
      data: {
        name: input.name,
        issuer: input.issuer,
        level: input.level || null,
        categories: input.categories,
        subtypes: input.subtypes,
        aliases: input.aliases,
        enabled: input.enabled,
      },
    });
    await this.audit(actor, 'admin.cert.create', { id: cert.id, name: cert.name });
    return cert;
  }

  async update(actor: AuthUser, id: string, patch: CertPatch) {
    const existing = await this.prisma.certificationCatalog.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ error: 'not_found', message: 'Certification not found.' });

    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!name) throw new BadRequestException({ error: 'invalid_name', message: 'Name is required.' });
      data.name = name;
    }
    if (patch.issuer !== undefined) {
      const issuer = String(patch.issuer).trim();
      if (!issuer) throw new BadRequestException({ error: 'invalid_issuer', message: 'Issuer is required.' });
      data.issuer = issuer;
    }
    if (patch.categories !== undefined) {
      const categories = patch.categories.map((c) => String(c).trim()).filter(Boolean);
      if (!categories.length) {
        throw new BadRequestException({ error: 'invalid_categories', message: 'At least one category is required.' });
      }
      data.categories = categories;
    }
    if (patch.level !== undefined) data.level = patch.level ? String(patch.level).trim() : null;
    if (patch.subtypes !== undefined) data.subtypes = patch.subtypes.map((s) => String(s).trim()).filter(Boolean);
    if (patch.aliases !== undefined) data.aliases = patch.aliases.map((s) => String(s).trim()).filter(Boolean);
    if (patch.enabled !== undefined) data.enabled = patch.enabled === true;

    if (Object.keys(data).length === 0) return existing;
    const updated = await this.prisma.certificationCatalog.update({ where: { id }, data });
    await this.audit(actor, 'admin.cert.update', { id, fields: Object.keys(data) });
    return updated;
  }

  async remove(actor: AuthUser, id: string) {
    const existing = await this.prisma.certificationCatalog.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ error: 'not_found', message: 'Certification not found.' });
    await this.prisma.certificationCatalog.delete({ where: { id } });
    await this.audit(actor, 'admin.cert.delete', { id, name: existing.name });
    return { deleted: true };
  }

  // A user couldn't find their cert → drop it on the manager's to-do list.
  // Deduped against open items by normalized text so the list doesn't fill with
  // the same cert typed slightly differently.
  async requestMissing(
    user: AuthUser,
    body: { rawText?: string; issuer?: string; category?: string; subtype?: string },
  ) {
    const rawText = (body.rawText ?? '').trim();
    if (!rawText) throw new BadRequestException({ error: 'invalid_text', message: 'Enter the certification name.' });
    const key = normCert(rawText);
    const open = await this.prisma.certificationTodo.findMany({ where: { status: 'open' } });
    const dupe = open.find((t) => normCert(t.rawText) === key);
    if (dupe) return dupe;
    return this.prisma.certificationTodo.create({
      data: {
        rawText,
        issuer: body.issuer?.trim() || null,
        category: body.category?.trim() || null,
        subtype: body.subtype?.trim() || null,
        requestedBy: user.userId,
      },
    });
  }

  listTodos(status = 'open') {
    return this.prisma.certificationTodo.findMany({ where: { status }, orderBy: { createdAt: 'desc' } });
  }

  async resolveTodo(actor: AuthUser, id: string, status: 'done' | 'dismissed') {
    const todo = await this.prisma.certificationTodo.findUnique({ where: { id } });
    if (!todo) throw new NotFoundException({ error: 'not_found', message: 'To-do item not found.' });
    const updated = await this.prisma.certificationTodo.update({ where: { id }, data: { status } });
    await this.audit(actor, 'admin.cert.todo_resolve', { id, status });
    return updated;
  }

  private validate(body: unknown): CertificationInput {
    const parsed = certificationInputSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'invalid_input',
        message: parsed.error.issues[0]?.message ?? 'Invalid certification.',
      });
    }
    return parsed.data;
  }

  // Cert events have no target session; logged against the acting user.
  private audit(actor: AuthUser, eventType: string, payload: Record<string, unknown>) {
    return this.prisma.auditLog.create({
      data: { userId: actor.userId, eventType, payload: { ...payload, actorEmail: actor.email } },
    });
  }
}
