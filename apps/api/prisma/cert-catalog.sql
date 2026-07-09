-- Additive migration for the Certification Catalog feature.
-- Safe to run on an existing DB (no DROP) — unlike init.sql, this keeps your data.
-- Idempotent: re-runnable thanks to IF NOT EXISTS / ON CONFLICT.
--   psql -h 127.0.0.1 -p 5433 -U cotailor -d cotailor -f apps/api/prisma/cert-catalog.sql

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "certSuggestionCount" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "ProfileCertification" ADD COLUMN IF NOT EXISTS "catalogId" TEXT;

CREATE TABLE IF NOT EXISTS "CertificationCatalog" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "issuer" TEXT NOT NULL, "level" TEXT,
  "category" TEXT NOT NULL,
  "subtypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CertificationCatalog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CertificationCatalog_category_idx" ON "CertificationCatalog"("category");

CREATE TABLE IF NOT EXISTS "CertificationTodo" (
  "id" TEXT NOT NULL, "rawText" TEXT NOT NULL, "issuer" TEXT, "category" TEXT, "subtype" TEXT,
  "requestedBy" TEXT, "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CertificationTodo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CertificationTodo_status_idx" ON "CertificationTodo"("status");

INSERT INTO "CertificationCatalog" ("id","name","issuer","level","category","subtypes","aliases") VALUES
  ('cert_aws_saa','AWS Certified Solutions Architect - Associate','AWS','associate','Software Engineering',ARRAY['Backend','DevOps','Full Stack'],ARRAY['AWS SAA','SAA-C03','Solutions Architect Associate']),
  ('cert_aws_dva','AWS Certified Developer - Associate','AWS','associate','Software Engineering',ARRAY['Backend','Full Stack','DevOps'],ARRAY['AWS DVA','DVA-C02']),
  ('cert_aws_devops','AWS Certified DevOps Engineer - Professional','AWS','professional','Software Engineering',ARRAY['DevOps'],ARRAY['AWS DOP','DOP-C02']),
  ('cert_aws_sysops','AWS Certified SysOps Administrator - Associate','AWS','associate','Software Engineering',ARRAY['DevOps'],ARRAY['SOA-C02']),
  ('cert_az_204','Microsoft Certified: Azure Developer Associate','Microsoft','associate','Software Engineering',ARRAY['Backend','Full Stack'],ARRAY['AZ-204','Azure Developer']),
  ('cert_az_104','Microsoft Certified: Azure Administrator Associate','Microsoft','associate','Software Engineering',ARRAY['DevOps'],ARRAY['AZ-104','Azure Admin']),
  ('cert_az_305','Microsoft Certified: Azure Solutions Architect Expert','Microsoft','professional','Software Engineering',ARRAY['Backend','DevOps'],ARRAY['AZ-305','Azure Architect']),
  ('cert_gcp_pca','Google Cloud Professional Cloud Architect','Google Cloud','professional','Software Engineering',ARRAY['Backend','DevOps'],ARRAY['GCP PCA','Professional Cloud Architect']),
  ('cert_gcp_ace','Google Cloud Associate Cloud Engineer','Google Cloud','associate','Software Engineering',ARRAY['DevOps','Backend'],ARRAY['GCP ACE','Associate Cloud Engineer']),
  ('cert_cka','Certified Kubernetes Administrator','CNCF','single','Software Engineering',ARRAY['DevOps'],ARRAY['CKA','Kubernetes Administrator']),
  ('cert_ckad','Certified Kubernetes Application Developer','CNCF','single','Software Engineering',ARRAY['DevOps','Backend'],ARRAY['CKAD']),
  ('cert_terraform','HashiCorp Certified: Terraform Associate','HashiCorp','associate','Software Engineering',ARRAY['DevOps'],ARRAY['Terraform Associate','HashiCorp Terraform']),
  ('cert_dca','Docker Certified Associate','Docker','associate','Software Engineering',ARRAY['DevOps'],ARRAY['DCA','Docker Associate']),
  ('cert_rhce','Red Hat Certified Engineer','Red Hat','professional','Software Engineering',ARRAY['DevOps'],ARRAY['RHCE']),
  ('cert_meta_fe','Meta Front-End Developer Professional Certificate','Meta','single','Software Engineering',ARRAY['Frontend','Full Stack'],ARRAY['Meta Frontend']),
  ('cert_jsnad','OpenJS Node.js Application Developer','OpenJS Foundation','single','Software Engineering',ARRAY['Backend','Full Stack'],ARRAY['JSNAD','Node.js Developer']),
  ('cert_java_se','Oracle Certified Professional: Java SE Developer','Oracle','professional','Software Engineering',ARRAY['Backend'],ARRAY['OCP Java','Java SE']),
  ('cert_mongo_dev','MongoDB Certified Developer Associate','MongoDB','associate','Software Engineering',ARRAY['Backend','Full Stack'],ARRAY['MongoDB Developer']),
  ('cert_android','Google Associate Android Developer','Google','associate','Software Engineering',ARRAY['Mobile'],ARRAY['Android Developer']),
  ('cert_security_plus','CompTIA Security+','CompTIA','single','Software Engineering',ARRAY['DevOps','Backend'],ARRAY['Security Plus','SY0-701']),
  ('cert_cissp','Certified Information Systems Security Professional','(ISC)2','professional','Software Engineering',ARRAY['DevOps'],ARRAY['CISSP']),
  ('cert_ceh','Certified Ethical Hacker','EC-Council','single','Software Engineering',ARRAY['DevOps'],ARRAY['CEH']),
  ('cert_aws_ml','AWS Certified Machine Learning - Specialty','AWS','specialty','Data Science',ARRAY['ML Engineer','Research'],ARRAY['AWS ML','MLS-C01']),
  ('cert_gcp_mle','Google Cloud Professional Machine Learning Engineer','Google Cloud','professional','Data Science',ARRAY['ML Engineer'],ARRAY['GCP PMLE']),
  ('cert_dp_100','Microsoft Certified: Azure Data Scientist Associate','Microsoft','associate','Data Science',ARRAY['ML Engineer','Research'],ARRAY['DP-100','Azure Data Scientist']),
  ('cert_tf_dev','TensorFlow Developer Certificate','Google','single','Data Science',ARRAY['ML Engineer','Research'],ARRAY['TensorFlow Developer','TF Developer']),
  ('cert_databricks_ml','Databricks Certified Machine Learning Associate','Databricks','associate','Data Science',ARRAY['ML Engineer'],ARRAY['Databricks ML']),
  ('cert_dp_203','Microsoft Certified: Azure Data Engineer Associate','Microsoft','associate','Data Science',ARRAY['Analytics','Data Analyst'],ARRAY['DP-203','Azure Data Engineer']),
  ('cert_gcp_pde','Google Cloud Professional Data Engineer','Google Cloud','professional','Data Science',ARRAY['Analytics','ML Engineer'],ARRAY['GCP PDE']),
  ('cert_databricks_de','Databricks Certified Data Engineer Associate','Databricks','associate','Data Science',ARRAY['Analytics'],ARRAY['Databricks Data Engineer']),
  ('cert_snowpro','SnowPro Core Certification','Snowflake','single','Data Science',ARRAY['Analytics','Data Analyst'],ARRAY['SnowPro']),
  ('cert_pl_300','Microsoft Certified: Power BI Data Analyst Associate','Microsoft','associate','Data Science',ARRAY['Data Analyst','Analytics'],ARRAY['PL-300','Power BI']),
  ('cert_tableau','Tableau Desktop Specialist','Tableau','single','Data Science',ARRAY['Data Analyst','Analytics'],ARRAY['Tableau']),
  ('cert_cspo','Certified Scrum Product Owner','Scrum Alliance','single','Product Management',ARRAY['PM','Technical PM'],ARRAY['CSPO']),
  ('cert_pspo','Professional Scrum Product Owner','Scrum.org','single','Product Management',ARRAY['PM','APM'],ARRAY['PSPO']),
  ('cert_pragmatic','Pragmatic Institute Certified','Pragmatic Institute','single','Product Management',ARRAY['PM','Strategy'],ARRAY['PMC']),
  ('cert_safe_popm','SAFe Product Owner/Product Manager','Scaled Agile','single','Product Management',ARRAY['Technical PM','PM'],ARRAY['SAFe POPM']),
  ('cert_nng_ux','Nielsen Norman Group UX Certification','NN/g','single','Design',ARRAY['UX','Product Designer'],ARRAY['NN/g UX','NNG UX']),
  ('cert_google_ux','Google UX Design Professional Certificate','Google','single','Design',ARRAY['UX','UI','Product Designer'],ARRAY['Google UX']),
  ('cert_adobe_acp','Adobe Certified Professional','Adobe','single','Design',ARRAY['Visual','UI'],ARRAY['ACP','Adobe Certified']),
  ('cert_sf_admin','Salesforce Certified Administrator','Salesforce','single','Sales',ARRAY['Enterprise','Inside Sales'],ARRAY['SF Admin','ADM-201']),
  ('cert_sf_sales','Salesforce Certified Sales Cloud Consultant','Salesforce','single','Sales',ARRAY['Enterprise'],ARRAY['Sales Cloud']),
  ('cert_hubspot_sales','HubSpot Sales Software Certification','HubSpot','single','Sales',ARRAY['SMB','Inside Sales'],ARRAY['HubSpot Sales']),
  ('cert_google_ads','Google Ads Certification','Google','single','Marketing',ARRAY['Performance','Growth'],ARRAY['Google Ads']),
  ('cert_google_analytics','Google Analytics Certification','Google','single','Marketing',ARRAY['Growth','Performance'],ARRAY['GA4','Google Analytics']),
  ('cert_hubspot_inbound','HubSpot Inbound Marketing Certification','HubSpot','single','Marketing',ARRAY['Content','Growth'],ARRAY['HubSpot Inbound']),
  ('cert_meta_blueprint','Meta Certified Digital Marketing Associate','Meta','single','Marketing',ARRAY['Performance','Growth'],ARRAY['Meta Blueprint']),
  ('cert_pmp','Project Management Professional','PMI','professional','Operations',ARRAY['Supply Chain','IT Ops'],ARRAY['PMP']),
  ('cert_itil','ITIL 4 Foundation','Axelos','foundational','Operations',ARRAY['IT Ops'],ARRAY['ITIL','ITIL 4']),
  ('cert_cscp','Certified Supply Chain Professional','ASCM','professional','Operations',ARRAY['Supply Chain'],ARRAY['CSCP']),
  ('cert_lssgb','Lean Six Sigma Green Belt','ASQ','single','Operations',ARRAY['Supply Chain','IT Ops'],ARRAY['LSSGB','Six Sigma Green Belt']),
  ('cert_cpa','Certified Public Accountant','AICPA','professional','Finance',ARRAY['Accounting'],ARRAY['CPA']),
  ('cert_cfa','Chartered Financial Analyst','CFA Institute','professional','Finance',ARRAY['Investment','Trading'],ARRAY['CFA']),
  ('cert_cma','Certified Management Accountant','IMA','professional','Finance',ARRAY['FP&A','Accounting'],ARRAY['CMA']),
  ('cert_fmva','Financial Modeling and Valuation Analyst','CFI','single','Finance',ARRAY['FP&A','Investment'],ARRAY['FMVA']),
  ('cert_frm','Financial Risk Manager','GARP','professional','Finance',ARRAY['Trading','Investment'],ARRAY['FRM']),
  ('cert_phr','Professional in Human Resources','HRCI','single','Human Resources',ARRAY['HRBP','Recruiter'],ARRAY['PHR']),
  ('cert_shrm_cp','SHRM Certified Professional','SHRM','single','Human Resources',ARRAY['HRBP','Recruiter'],ARRAY['SHRM-CP']),
  ('cert_ccp','Certified Compensation Professional','WorldatWork','single','Human Resources',ARRAY['Compensation'],ARRAY['CCP']),
  ('cert_aptd','Associate Professional in Talent Development','ATD','single','Human Resources',ARRAY['Learning'],ARRAY['APTD'])
ON CONFLICT ("id") DO NOTHING;
