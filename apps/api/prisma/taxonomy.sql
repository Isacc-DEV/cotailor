-- Migration: managed role taxonomy (Category -> Subtype). Idempotent.
-- Seeds a unified list (fixes the old JD-side vs profile-side category split).
-- A mid-level `family` is planned for a later version.
--   psql -h 127.0.0.1 -p 5433 -U cotailor -d cotailor -f apps/api/prisma/taxonomy.sql

CREATE TABLE IF NOT EXISTS "TaxonomyCategory" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxonomyCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TaxonomyCategory_name_key" ON "TaxonomyCategory"("name");

CREATE TABLE IF NOT EXISTS "TaxonomySubtype" (
  "id" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 100, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxonomySubtype_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TaxonomySubtype_categoryId_name_key" ON "TaxonomySubtype"("categoryId","name");
CREATE INDEX IF NOT EXISTS "TaxonomySubtype_categoryId_idx" ON "TaxonomySubtype"("categoryId");

INSERT INTO "TaxonomyCategory" ("id","name","sortOrder") VALUES
  ('cat_swe','Software Engineering',10),
  ('cat_ds','Data Science',20),
  ('cat_pm','Product Management',30),
  ('cat_design','Design',40),
  ('cat_marketing','Marketing',50),
  ('cat_sales','Sales',60),
  ('cat_finance','Finance',70),
  ('cat_ops','Operations',80),
  ('cat_hr','Human Resources',90),
  ('cat_health','Healthcare',100),
  ('cat_civil','Civil/Mechanical Engineering',110)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "TaxonomySubtype" ("id","categoryId","name","sortOrder") VALUES
  ('sub_swe_frontend','cat_swe','Frontend',10),
  ('sub_swe_backend','cat_swe','Backend',20),
  ('sub_swe_fullstack','cat_swe','Full Stack',30),
  ('sub_swe_ai_fullstack','cat_swe','AI Full Stack',40),
  ('sub_swe_mobile','cat_swe','Mobile',50),
  ('sub_swe_ai_engineer','cat_swe','AI Engineer',60),
  ('sub_swe_ml_engineer','cat_swe','ML Engineer',70),
  ('sub_swe_ai_agentic','cat_swe','AI Agentic Engineer',80),
  ('sub_swe_devops','cat_swe','DevOps',90),
  ('sub_swe_devsecops','cat_swe','DevSecOps',100),
  ('sub_swe_sre','cat_swe','SRE',110),
  ('sub_swe_platform','cat_swe','Platform Engineer',120),
  ('sub_swe_cloud','cat_swe','Cloud Engineer',130),
  ('sub_swe_mlops','cat_swe','MLOps',140),
  ('sub_swe_data_engineer','cat_swe','Data Engineer',150),
  ('sub_swe_analytics_engineer','cat_swe','Analytics Engineer',160),
  ('sub_swe_qa','cat_swe','QA/SDET',170),
  ('sub_swe_security','cat_swe','Security Engineer',180),
  ('sub_ds_data_analyst','cat_ds','Data Analyst',10),
  ('sub_ds_data_scientist','cat_ds','Data Scientist',20),
  ('sub_ds_analytics','cat_ds','Analytics',30),
  ('sub_ds_research','cat_ds','Research',40),
  ('sub_pm_apm','cat_pm','APM',10),
  ('sub_pm_pm','cat_pm','PM',20),
  ('sub_pm_tech','cat_pm','Technical PM',30),
  ('sub_pm_strategy','cat_pm','Strategy',40),
  ('sub_design_ux','cat_design','UX',10),
  ('sub_design_ui','cat_design','UI',20),
  ('sub_design_product','cat_design','Product Designer',30),
  ('sub_design_visual','cat_design','Visual',40),
  ('sub_mkt_growth','cat_marketing','Growth',10),
  ('sub_mkt_content','cat_marketing','Content',20),
  ('sub_mkt_brand','cat_marketing','Brand',30),
  ('sub_mkt_performance','cat_marketing','Performance',40),
  ('sub_sales_enterprise','cat_sales','Enterprise',10),
  ('sub_sales_smb','cat_sales','SMB',20),
  ('sub_sales_field','cat_sales','Field',30),
  ('sub_sales_inside','cat_sales','Inside Sales',40),
  ('sub_fin_fpa','cat_finance','FP&A',10),
  ('sub_fin_accounting','cat_finance','Accounting',20),
  ('sub_fin_investment','cat_finance','Investment',30),
  ('sub_fin_trading','cat_finance','Trading',40),
  ('sub_ops_business','cat_ops','Business Ops',10),
  ('sub_ops_supply','cat_ops','Supply Chain',20),
  ('sub_ops_it','cat_ops','IT Ops',30),
  ('sub_ops_program','cat_ops','Program Management',40),
  ('sub_hr_recruiter','cat_hr','Recruiter',10),
  ('sub_hr_hrbp','cat_hr','HRBP',20),
  ('sub_hr_comp','cat_hr','Compensation',30),
  ('sub_hr_learning','cat_hr','Learning',40),
  ('sub_health_clinical','cat_health','Clinical',10),
  ('sub_health_nursing','cat_health','Nursing',20),
  ('sub_health_allied','cat_health','Allied Health',30),
  ('sub_civil_structural','cat_civil','Structural',10),
  ('sub_civil_civil','cat_civil','Civil',20),
  ('sub_civil_mechanical','cat_civil','Mechanical',30)
ON CONFLICT ("id") DO NOTHING;
