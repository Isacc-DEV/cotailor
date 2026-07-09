import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  taxonomyCategoryInputSchema,
  taxonomyFamilyInputSchema,
  taxonomySubtypeInputSchema,
} from '@cotailor/shared';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.guard';

export interface CategoryPatch {
  name?: string;
  sortOrder?: number;
  enabled?: boolean;
}
export interface FamilyPatch {
  name?: string;
  sortOrder?: number;
  enabled?: boolean;
}
export interface SubtypePatch {
  name?: string;
  sortOrder?: number;
  enabled?: boolean;
  categoryId?: string; // move to another category
  familyId?: string | null; // move into a family, or null to ungroup
}

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  // Nested tree. Public read passes includeDisabled=false (profile form + prompts
  // only see live entries); the admin console passes true to manage everything.
  async tree(includeDisabled = false) {
    const catWhere = includeDisabled ? {} : { enabled: true };
    const subWhere = includeDisabled ? {} : { enabled: true };
    const cats = await this.prisma.taxonomyCategory.findMany({
      where: catWhere,
      orderBy: { sortOrder: 'asc' },
      include: { subtypes: { where: subWhere, orderBy: { sortOrder: 'asc' } } },
    });
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      enabled: c.enabled,
      subtypes: c.subtypes.map((s) => ({ id: s.id, name: s.name, sortOrder: s.sortOrder, enabled: s.enabled })),
    }));
  }

  // Family-structured tree for the admin console: each category lists its
  // families (with their subtypes) plus any ungrouped subtypes. Includes disabled.
  async adminTree() {
    const cats = await this.prisma.taxonomyCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        families: { orderBy: { sortOrder: 'asc' } },
        subtypes: { orderBy: { sortOrder: 'asc' } },
      },
    });
    const sMap = (s: { id: string; name: string; sortOrder: number; enabled: boolean; familyId: string | null }) => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sortOrder,
      enabled: s.enabled,
      familyId: s.familyId,
    });
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      enabled: c.enabled,
      families: c.families.map((f) => ({
        id: f.id,
        name: f.name,
        sortOrder: f.sortOrder,
        enabled: f.enabled,
        subtypes: c.subtypes.filter((s) => s.familyId === f.id).map(sMap),
      })),
      subtypes: c.subtypes.filter((s) => !s.familyId).map(sMap),
    }));
  }

  // ---- Categories ----
  async createCategory(actor: AuthUser, body: unknown) {
    const input = this.parse(taxonomyCategoryInputSchema, body);
    const existing = await this.prisma.taxonomyCategory.findUnique({ where: { name: input.name } });
    if (existing) {
      throw new ConflictException({ error: 'name_exists', message: `Category "${input.name}" already exists.` });
    }
    const sortOrder = input.sortOrder ?? (await this.nextCategoryOrder());
    const cat = await this.prisma.taxonomyCategory.create({
      data: { name: input.name, sortOrder, enabled: input.enabled },
    });
    await this.audit(actor, 'admin.taxonomy.category.create', { id: cat.id, name: cat.name });
    return cat;
  }

  async updateCategory(actor: AuthUser, id: string, patch: CategoryPatch) {
    const cat = await this.prisma.taxonomyCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException({ error: 'not_found', message: 'Category not found.' });
    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!name) throw new BadRequestException({ error: 'invalid_name', message: 'Name is required.' });
      if (name !== cat.name) {
        const dupe = await this.prisma.taxonomyCategory.findUnique({ where: { name } });
        if (dupe) throw new ConflictException({ error: 'name_exists', message: `Category "${name}" already exists.` });
      }
      data.name = name;
    }
    if (patch.sortOrder !== undefined && Number.isFinite(patch.sortOrder)) data.sortOrder = Math.trunc(patch.sortOrder);
    if (patch.enabled !== undefined) data.enabled = patch.enabled === true;
    if (Object.keys(data).length === 0) return cat;
    const updated = await this.prisma.taxonomyCategory.update({ where: { id }, data });
    await this.audit(actor, 'admin.taxonomy.category.update', { id, fields: Object.keys(data) });
    return updated;
  }

  async deleteCategory(actor: AuthUser, id: string) {
    const cat = await this.prisma.taxonomyCategory.findUnique({ where: { id }, include: { subtypes: true } });
    if (!cat) throw new NotFoundException({ error: 'not_found', message: 'Category not found.' });
    // No DB-level FKs in this project, so cascade the children manually.
    await this.prisma.taxonomySubtype.deleteMany({ where: { categoryId: id } });
    await this.prisma.taxonomyFamily.deleteMany({ where: { categoryId: id } });
    await this.prisma.taxonomyCategory.delete({ where: { id } });
    await this.audit(actor, 'admin.taxonomy.category.delete', {
      id,
      name: cat.name,
      removedSubtypes: cat.subtypes.length,
    });
    return { deleted: true };
  }

  // ---- Subtypes ----
  async createSubtype(actor: AuthUser, body: unknown) {
    const input = this.parse(taxonomySubtypeInputSchema, body);
    const cat = await this.prisma.taxonomyCategory.findUnique({ where: { id: input.categoryId } });
    if (!cat) throw new BadRequestException({ error: 'invalid_category', message: 'Category not found.' });
    let familyId: string | null = null;
    if (input.familyId) {
      const fam = await this.prisma.taxonomyFamily.findUnique({ where: { id: input.familyId } });
      if (!fam || fam.categoryId !== input.categoryId) {
        throw new BadRequestException({ error: 'invalid_family', message: 'Family not found in this category.' });
      }
      familyId = fam.id;
    }
    await this.assertSubtypeNameFree(input.categoryId, input.name);
    const sortOrder = input.sortOrder ?? (await this.nextSubtypeOrder(input.categoryId, familyId));
    const sub = await this.prisma.taxonomySubtype.create({
      data: { categoryId: input.categoryId, familyId, name: input.name, sortOrder, enabled: input.enabled },
    });
    await this.audit(actor, 'admin.taxonomy.subtype.create', {
      id: sub.id,
      name: sub.name,
      categoryId: input.categoryId,
    });
    return sub;
  }

  // Handles rename, reorder, enable/disable AND move (set categoryId).
  async updateSubtype(actor: AuthUser, id: string, patch: SubtypePatch) {
    const sub = await this.prisma.taxonomySubtype.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException({ error: 'not_found', message: 'Subtype not found.' });
    const data: Record<string, unknown> = {};

    // Move into a family (implies its category), or ungroup (familyId null).
    if (patch.familyId !== undefined) {
      if (patch.familyId === null) {
        data.familyId = null;
      } else {
        const fam = await this.prisma.taxonomyFamily.findUnique({ where: { id: patch.familyId } });
        if (!fam) throw new BadRequestException({ error: 'invalid_family', message: 'Target family not found.' });
        data.familyId = fam.id;
        data.categoryId = fam.categoryId;
      }
    } else if (patch.categoryId !== undefined && patch.categoryId !== sub.categoryId) {
      const cat = await this.prisma.taxonomyCategory.findUnique({ where: { id: patch.categoryId } });
      if (!cat) throw new BadRequestException({ error: 'invalid_category', message: 'Target category not found.' });
      data.categoryId = patch.categoryId;
      data.familyId = null; // moving to another category ungroups
    }

    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!name) throw new BadRequestException({ error: 'invalid_name', message: 'Name is required.' });
      data.name = name;
    }
    if (patch.sortOrder !== undefined && Number.isFinite(patch.sortOrder)) data.sortOrder = Math.trunc(patch.sortOrder);
    if (patch.enabled !== undefined) data.enabled = patch.enabled === true;
    if (data.categoryId || data.name) {
      const targetCategory = (data.categoryId as string) ?? sub.categoryId;
      await this.assertSubtypeNameFree(targetCategory, (data.name as string) ?? sub.name, id);
    }
    if (Object.keys(data).length === 0) return sub;
    const updated = await this.prisma.taxonomySubtype.update({ where: { id }, data });
    await this.audit(actor, 'admin.taxonomy.subtype.update', { id, fields: Object.keys(data) });
    return updated;
  }

  async deleteSubtype(actor: AuthUser, id: string) {
    const sub = await this.prisma.taxonomySubtype.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException({ error: 'not_found', message: 'Subtype not found.' });
    await this.prisma.taxonomySubtype.delete({ where: { id } });
    await this.audit(actor, 'admin.taxonomy.subtype.delete', { id, name: sub.name });
    return { deleted: true };
  }

  private async assertSubtypeNameFree(categoryId: string, name: string, exceptId?: string) {
    const dupe = await this.prisma.taxonomySubtype.findFirst({
      where: { categoryId, name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (dupe) {
      throw new ConflictException({ error: 'name_exists', message: `"${name}" already exists in this category.` });
    }
  }

  private async nextCategoryOrder(): Promise<number> {
    const agg = await this.prisma.taxonomyCategory.aggregate({ _max: { sortOrder: true } });
    return (agg._max.sortOrder ?? 0) + 10;
  }

  private async nextSubtypeOrder(categoryId: string, familyId: string | null = null): Promise<number> {
    const agg = await this.prisma.taxonomySubtype.aggregate({
      where: { categoryId, familyId },
      _max: { sortOrder: true },
    });
    return (agg._max.sortOrder ?? 0) + 10;
  }

  // ---- Families ----
  async createFamily(actor: AuthUser, body: unknown) {
    const input = this.parse(taxonomyFamilyInputSchema, body);
    const cat = await this.prisma.taxonomyCategory.findUnique({ where: { id: input.categoryId } });
    if (!cat) throw new BadRequestException({ error: 'invalid_category', message: 'Category not found.' });
    await this.assertFamilyNameFree(input.categoryId, input.name);
    const sortOrder = input.sortOrder ?? (await this.nextFamilyOrder(input.categoryId));
    const fam = await this.prisma.taxonomyFamily.create({
      data: { categoryId: input.categoryId, name: input.name, sortOrder, enabled: input.enabled },
    });
    await this.audit(actor, 'admin.taxonomy.family.create', { id: fam.id, name: fam.name, categoryId: input.categoryId });
    return fam;
  }

  async updateFamily(actor: AuthUser, id: string, patch: FamilyPatch) {
    const fam = await this.prisma.taxonomyFamily.findUnique({ where: { id } });
    if (!fam) throw new NotFoundException({ error: 'not_found', message: 'Family not found.' });
    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!name) throw new BadRequestException({ error: 'invalid_name', message: 'Name is required.' });
      await this.assertFamilyNameFree(fam.categoryId, name, id);
      data.name = name;
    }
    if (patch.sortOrder !== undefined && Number.isFinite(patch.sortOrder)) data.sortOrder = Math.trunc(patch.sortOrder);
    if (patch.enabled !== undefined) data.enabled = patch.enabled === true;
    if (Object.keys(data).length === 0) return fam;
    const updated = await this.prisma.taxonomyFamily.update({ where: { id }, data });
    await this.audit(actor, 'admin.taxonomy.family.update', { id, fields: Object.keys(data) });
    return updated;
  }

  // Deleting a family ungroups its subtypes (they stay in the category) — never deletes them.
  async deleteFamily(actor: AuthUser, id: string) {
    const fam = await this.prisma.taxonomyFamily.findUnique({ where: { id } });
    if (!fam) throw new NotFoundException({ error: 'not_found', message: 'Family not found.' });
    await this.prisma.taxonomySubtype.updateMany({ where: { familyId: id }, data: { familyId: null } });
    await this.prisma.taxonomyFamily.delete({ where: { id } });
    await this.audit(actor, 'admin.taxonomy.family.delete', { id, name: fam.name });
    return { deleted: true };
  }

  private async assertFamilyNameFree(categoryId: string, name: string, exceptId?: string) {
    const dupe = await this.prisma.taxonomyFamily.findFirst({
      where: { categoryId, name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (dupe) {
      throw new ConflictException({ error: 'name_exists', message: `Family "${name}" already exists in this category.` });
    }
  }

  private async nextFamilyOrder(categoryId: string): Promise<number> {
    const agg = await this.prisma.taxonomyFamily.aggregate({ where: { categoryId }, _max: { sortOrder: true } });
    return (agg._max.sortOrder ?? 0) + 10;
  }

  private parse<T>(schema: z.ZodType<T>, body: unknown): T {
    const r = schema.safeParse(body ?? {});
    if (!r.success) {
      throw new BadRequestException({ error: 'invalid_input', message: r.error.issues[0]?.message ?? 'Invalid input.' });
    }
    return r.data;
  }

  private audit(actor: AuthUser, eventType: string, payload: Record<string, unknown>) {
    return this.prisma.auditLog.create({
      data: { userId: actor.userId, eventType, payload: { ...payload, actorEmail: actor.email } },
    });
  }
}
