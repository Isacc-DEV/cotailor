import { z } from 'zod';

// Certification levels, low → high (specialty/single are orthogonal tiers).
export const CERT_LEVELS = ['foundational', 'associate', 'professional', 'specialty', 'single'] as const;
export type CertLevel = (typeof CERT_LEVELS)[number];

// A manager-curated certification. The AI may only SELECT from these rows — it
// never invents a cert name. Filed under one category and MANY subtypes, so a
// single cert (e.g. AWS Solutions Architect) surfaces for Backend, DevOps and
// Cloud at once.
export const certificationCatalogSchema = z.object({
  id: z.string(),
  name: z.string(),
  issuer: z.string(),
  level: z.string().nullable().optional(),
  categories: z.array(z.string()),
  subtypes: z.array(z.string()),
  aliases: z.array(z.string()),
  enabled: z.boolean(),
});
export type CertificationCatalogEntry = z.infer<typeof certificationCatalogSchema>;

// Admin create/update input. Server fills id and timestamps.
export const certificationInputSchema = z.object({
  name: z.string().trim().min(1),
  issuer: z.string().trim().min(1),
  level: z.string().trim().optional(),
  categories: z.array(z.string().trim().min(1)).min(1),
  subtypes: z.array(z.string().trim().min(1)).default([]),
  aliases: z.array(z.string().trim().min(1)).default([]),
  enabled: z.boolean().default(true),
});
export type CertificationInput = z.infer<typeof certificationInputSchema>;

// One cert the AI picked for a job, chosen from the candidate list by id.
export const certSelectionSchema = z.object({
  catalogId: z.string(),
  reason: z.string().optional(),
});
export const certSelectionResultSchema = z.object({
  selected: z.array(certSelectionSchema),
});
export type CertSelectionResult = z.infer<typeof certSelectionResultSchema>;

// Normalize a cert name/alias into a match key: lowercase, drop punctuation and
// the filler words "certified/certificate/certification/cert", collapse spaces.
// Mirrors the skills norm() so cert matching behaves like skill matching.
export function normCert(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(certified|certificate|certification|cert)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build a normalized-key → cert lookup from catalog rows (canonical name plus
// every alias). Earlier rows win on key collisions.
export function buildCertIndex(
  rows: CertificationCatalogEntry[],
): Map<string, CertificationCatalogEntry> {
  const index = new Map<string, CertificationCatalogEntry>();
  for (const row of rows) {
    for (const key of [row.name, ...row.aliases]) {
      const k = normCert(key);
      if (k && !index.has(k)) index.set(k, row);
    }
  }
  return index;
}

// Does the profile hold this catalog cert? Matches by explicit catalogId link
// first, then falls back to a normalized name/alias match for custom entries.
export function profileHoldsCert(
  cert: CertificationCatalogEntry,
  profileCerts: Array<{ name?: string; catalogId?: string | null }>,
): boolean {
  if (profileCerts.some((p) => p.catalogId && p.catalogId === cert.id)) return true;
  const keys = new Set([cert.name, ...cert.aliases].map(normCert));
  return profileCerts.some((p) => p.name && keys.has(normCert(p.name)));
}
