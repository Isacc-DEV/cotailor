import { z } from 'zod';

// The managed role taxonomy (2-level: Category -> Subtype). Replaces the
// hard-coded CATEGORY_TAXONOMY / PROFILE_SUBTYPES constants. A `family` mid-level
// is planned for a later version — the shapes below leave room for it.

export const taxonomySubtypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number(),
  enabled: z.boolean(),
});
export type TaxonomySubtypeNode = z.infer<typeof taxonomySubtypeSchema>;

export const taxonomyCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number(),
  enabled: z.boolean(),
  subtypes: z.array(taxonomySubtypeSchema),
});
export type TaxonomyCategoryNode = z.infer<typeof taxonomyCategorySchema>;

// The full tree the profile form + prompts consume.
export const taxonomyTreeSchema = z.array(taxonomyCategorySchema);
export type TaxonomyTree = z.infer<typeof taxonomyTreeSchema>;

// Admin create/update inputs. Server fills id/timestamps and defaults sortOrder.
export const taxonomyCategoryInputSchema = z.object({
  name: z.string().trim().min(1),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().default(true),
});
export type TaxonomyCategoryInput = z.infer<typeof taxonomyCategoryInputSchema>;

export const taxonomySubtypeInputSchema = z.object({
  categoryId: z.string().min(1),
  familyId: z.string().optional(), // optional mid-level; null/absent = ungrouped
  name: z.string().trim().min(1),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().default(true),
});
export type TaxonomySubtypeInput = z.infer<typeof taxonomySubtypeInputSchema>;

// A family is optional grouping within a category.
export const taxonomyFamilyInputSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().default(true),
});
export type TaxonomyFamilyInput = z.infer<typeof taxonomyFamilyInputSchema>;

// Enabled-only category name list — what the JD-analyze prompt injects.
export function categoryNames(tree: TaxonomyTree): string[] {
  return tree.filter((c) => c.enabled).map((c) => c.name);
}
