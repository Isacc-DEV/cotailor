import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { TaxonomyService, type CategoryPatch, type FamilyPatch, type SubtypePatch } from './taxonomy.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.guard';

// JwtAuthGuard (global) first, then AdminGuard's fresh DB check.
@Controller('admin/taxonomy')
@UseGuards(AdminGuard)
export class AdminTaxonomyController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  // Family-structured tree including disabled entries, for the console.
  @Get()
  tree() {
    return this.taxonomy.adminTree();
  }

  @Post('categories')
  createCategory(@CurrentUser() actor: AuthUser, @Body() body: unknown) {
    return this.taxonomy.createCategory(actor, body ?? {});
  }

  @Patch('categories/:id')
  updateCategory(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: CategoryPatch) {
    return this.taxonomy.updateCategory(actor, id, body ?? {});
  }

  @Delete('categories/:id')
  deleteCategory(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.taxonomy.deleteCategory(actor, id);
  }

  @Post('families')
  createFamily(@CurrentUser() actor: AuthUser, @Body() body: unknown) {
    return this.taxonomy.createFamily(actor, body ?? {});
  }

  @Patch('families/:id')
  updateFamily(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: FamilyPatch) {
    return this.taxonomy.updateFamily(actor, id, body ?? {});
  }

  @Delete('families/:id')
  deleteFamily(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.taxonomy.deleteFamily(actor, id);
  }

  @Post('subtypes')
  createSubtype(@CurrentUser() actor: AuthUser, @Body() body: unknown) {
    return this.taxonomy.createSubtype(actor, body ?? {});
  }

  // PATCH covers rename, reorder, enable/disable, and move (set categoryId).
  @Patch('subtypes/:id')
  updateSubtype(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: SubtypePatch) {
    return this.taxonomy.updateSubtype(actor, id, body ?? {});
  }

  @Delete('subtypes/:id')
  deleteSubtype(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.taxonomy.deleteSubtype(actor, id);
  }
}
