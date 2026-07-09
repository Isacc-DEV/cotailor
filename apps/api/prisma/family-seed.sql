-- Organize the seeded subtypes into families (optional grouping). Idempotent.
-- Healthcare + Civil/Mechanical are left ungrouped (only 3 subtypes each).
--   psql -h 127.0.0.1 -p 5433 -U cotailor -d cotailor -f apps/api/prisma/family-seed.sql

INSERT INTO "TaxonomyFamily" ("id","categoryId","name","sortOrder") VALUES
  ('fam_swe_app','cat_swe','App Engineering',10),
  ('fam_swe_mobile','cat_swe','Mobile',20),
  ('fam_swe_ai','cat_swe','AI / ML Engineering',30),
  ('fam_swe_platform','cat_swe','Platform / DevOps',40),
  ('fam_swe_data','cat_swe','Data Engineering',50),
  ('fam_swe_quality','cat_swe','Quality & Security',60),
  ('fam_ds_analysis','cat_ds','Analysis',10),
  ('fam_ds_research','cat_ds','Research & Modeling',20),
  ('fam_pm_product','cat_pm','Product',10),
  ('fam_pm_strategy','cat_pm','Technical & Strategy',20),
  ('fam_design_product','cat_design','Product Design',10),
  ('fam_design_visual','cat_design','Visual & Brand',20),
  ('fam_sales_field','cat_sales','Field & Enterprise',10),
  ('fam_sales_inside','cat_sales','Inside & SMB',20),
  ('fam_mkt_growth','cat_marketing','Growth & Performance',10),
  ('fam_mkt_brand','cat_marketing','Content & Brand',20),
  ('fam_ops_business','cat_ops','Business Ops',10),
  ('fam_ops_supply','cat_ops','Supply Chain & IT',20),
  ('fam_fin_corp','cat_finance','Corporate Finance',10),
  ('fam_fin_markets','cat_finance','Markets',20),
  ('fam_hr_talent','cat_hr','Talent',10),
  ('fam_hr_rewards','cat_hr','Rewards & Development',20)
ON CONFLICT ("id") DO NOTHING;

UPDATE "TaxonomySubtype" SET "familyId"='fam_swe_app'      WHERE id IN ('sub_swe_frontend','sub_swe_backend','sub_swe_fullstack','sub_swe_ai_fullstack');
UPDATE "TaxonomySubtype" SET "familyId"='fam_swe_mobile'   WHERE id IN ('sub_swe_mobile');
UPDATE "TaxonomySubtype" SET "familyId"='fam_swe_ai'       WHERE id IN ('sub_swe_ai_engineer','sub_swe_ml_engineer','sub_swe_ai_agentic');
UPDATE "TaxonomySubtype" SET "familyId"='fam_swe_platform' WHERE id IN ('sub_swe_devops','sub_swe_devsecops','sub_swe_sre','sub_swe_platform','sub_swe_cloud','sub_swe_mlops');
UPDATE "TaxonomySubtype" SET "familyId"='fam_swe_data'     WHERE id IN ('sub_swe_data_engineer','sub_swe_analytics_engineer');
UPDATE "TaxonomySubtype" SET "familyId"='fam_swe_quality'  WHERE id IN ('sub_swe_qa','sub_swe_security');
UPDATE "TaxonomySubtype" SET "familyId"='fam_ds_analysis'  WHERE id IN ('sub_ds_data_analyst','sub_ds_analytics');
UPDATE "TaxonomySubtype" SET "familyId"='fam_ds_research'  WHERE id IN ('sub_ds_data_scientist','sub_ds_research');
UPDATE "TaxonomySubtype" SET "familyId"='fam_pm_product'   WHERE id IN ('sub_pm_apm','sub_pm_pm');
UPDATE "TaxonomySubtype" SET "familyId"='fam_pm_strategy'  WHERE id IN ('sub_pm_tech','sub_pm_strategy');
UPDATE "TaxonomySubtype" SET "familyId"='fam_design_product' WHERE id IN ('sub_design_ux','sub_design_ui','sub_design_product');
UPDATE "TaxonomySubtype" SET "familyId"='fam_design_visual'  WHERE id IN ('sub_design_visual');
UPDATE "TaxonomySubtype" SET "familyId"='fam_sales_field'  WHERE id IN ('sub_sales_enterprise','sub_sales_field');
UPDATE "TaxonomySubtype" SET "familyId"='fam_sales_inside' WHERE id IN ('sub_sales_smb','sub_sales_inside');
UPDATE "TaxonomySubtype" SET "familyId"='fam_mkt_growth'   WHERE id IN ('sub_mkt_growth','sub_mkt_performance');
UPDATE "TaxonomySubtype" SET "familyId"='fam_mkt_brand'    WHERE id IN ('sub_mkt_content','sub_mkt_brand');
UPDATE "TaxonomySubtype" SET "familyId"='fam_ops_business' WHERE id IN ('sub_ops_business','sub_ops_program');
UPDATE "TaxonomySubtype" SET "familyId"='fam_ops_supply'   WHERE id IN ('sub_ops_supply','sub_ops_it');
UPDATE "TaxonomySubtype" SET "familyId"='fam_fin_corp'     WHERE id IN ('sub_fin_fpa','sub_fin_accounting');
UPDATE "TaxonomySubtype" SET "familyId"='fam_fin_markets'  WHERE id IN ('sub_fin_investment','sub_fin_trading');
UPDATE "TaxonomySubtype" SET "familyId"='fam_hr_talent'    WHERE id IN ('sub_hr_recruiter','sub_hr_hrbp');
UPDATE "TaxonomySubtype" SET "familyId"='fam_hr_rewards'   WHERE id IN ('sub_hr_comp','sub_hr_learning');
