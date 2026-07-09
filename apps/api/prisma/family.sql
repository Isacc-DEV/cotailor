-- Migration: optional mid-level family grouping in the taxonomy. Non-destructive
-- (existing subtypes stay "ungrouped" with familyId NULL). Idempotent.
--   psql -h 127.0.0.1 -p 5433 -U cotailor -d cotailor -f apps/api/prisma/family.sql

CREATE TABLE IF NOT EXISTS "TaxonomyFamily" (
  "id" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 100, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxonomyFamily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TaxonomyFamily_categoryId_name_key" ON "TaxonomyFamily"("categoryId","name");
CREATE INDEX IF NOT EXISTS "TaxonomyFamily_categoryId_idx" ON "TaxonomyFamily"("categoryId");

ALTER TABLE "TaxonomySubtype" ADD COLUMN IF NOT EXISTS "familyId" TEXT;
CREATE INDEX IF NOT EXISTS "TaxonomySubtype_familyId_idx" ON "TaxonomySubtype"("familyId");
