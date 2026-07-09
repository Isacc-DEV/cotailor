-- CoTailor schema DDL (matches prisma/schema.prisma). Applied directly via psql
-- because the native Prisma schema engine can't run in some environments (SIGILL).
-- Re-runnable: resets the public schema.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ===== Enums =====
CREATE TYPE "Seniority" AS ENUM ('intern','junior','mid','senior','lead','staff','principal','manager_plus');
CREATE TYPE "SessionState" AS ENUM ('CREATED','JD_SUBMITTED','ANALYZING','CATEGORY_REJECTED','WAITING_CATEGORY_CONFIRMATION','WAITING_SUBTYPE_CONFIRMATION','WAITING_SKILL_DECISIONS','STRATEGY_REVIEW','GENERATING','VALIDATING','NEEDS_REVISION','FINAL_READY','REVISING','CANCELLED','EXPIRED');
CREATE TYPE "SkillPriority" AS ENUM ('required','preferred');
CREATE TYPE "MatchType" AS ENUM ('exact','equivalent','similar_stack','same_family','missing','blocked_sensitive');
CREATE TYPE "RiskLevel" AS ENUM ('none','low','medium','high','critical');
CREATE TYPE "CardType" AS ENUM ('category_mismatch','category_low_confidence','subtype_mismatch','seniority_gap','knockout_requirement','missing_required_skill','similar_skill','certification_risk','resume_style','strategy_approval');
CREATE TYPE "CardSeverity" AS ENUM ('info','warning','blocking','critical');
CREATE TYPE "CardStatus" AS ENUM ('pending','answered','auto_resolved','expired');
CREATE TYPE "Provenance" AS ENUM ('profile_verified','user_confirmed','omitted');
CREATE TYPE "ResumeStyle" AS ENUM ('ats_strong','recruiter_friendly','balanced');
CREATE TYPE "CreatedBy" AS ENUM ('ai_generation','ai_revision','user_edit');
CREATE TYPE "ScreeningOutlook" AS ENUM ('likely_pass','borderline','unlikely');
CREATE TYPE "ExportFormat" AS ENUM ('docx','pdf','txt');
CREATE TYPE "CategoryRelationKind" AS ENUM ('same','adjacent','distinct');
CREATE TYPE "Role" AS ENUM ('user','admin');
CREATE TYPE "UserStatus" AS ENUM ('pending','active','suspended');
CREATE TYPE "ThemePref" AS ENUM ('light','dark','system');
CREATE TYPE "AiProviderMode" AS ENUM ('cotailor','own_keys');

-- ===== Tables =====
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "passwordHash" TEXT,
  "role" "Role" NOT NULL DEFAULT 'user',
  "status" "UserStatus" NOT NULL DEFAULT 'pending',
  "theme" "ThemePref" NOT NULL DEFAULT 'system',
  "aiProviderMode" "AiProviderMode" NOT NULL DEFAULT 'cotailor',
  "certSuggestionCount" INTEGER NOT NULL DEFAULT 3,
  "verifiedAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Profile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "baseResume" JSONB NOT NULL,
  "domainTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "workAuthorization" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileSubtype" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "name" TEXT NOT NULL,
  CONSTRAINT "ProfileSubtype_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileSkill" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "name" TEXT NOT NULL, "years" INTEGER,
  CONSTRAINT "ProfileSkill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileCertification" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "name" TEXT NOT NULL, "issuer" TEXT, "catalogId" TEXT,
  CONSTRAINT "ProfileCertification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JdDocument" (
  "id" TEXT NOT NULL, "userId" TEXT, "contentHash" TEXT NOT NULL, "text" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'paste',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JdDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JdDocument_contentHash_key" ON "JdDocument"("contentHash");

CREATE TABLE "TailoringSession" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "profileId" TEXT NOT NULL, "jdDocumentId" TEXT,
  "state" "SessionState" NOT NULL DEFAULT 'CREATED',
  "profileSnapshot" JSONB, "activeVersionId" TEXT,
  "revisionCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "TailoringSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JdAnalysis" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "jdDocumentId" TEXT NOT NULL,
  "category" TEXT NOT NULL, "categoryConfidence" DOUBLE PRECISION NOT NULL,
  "subtype" TEXT NOT NULL, "subtypeConfidence" DOUBLE PRECISION NOT NULL,
  "domainKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "summary" TEXT NOT NULL, "raw" JSONB NOT NULL,
  "promptVersion" TEXT, "modelUsed" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JdAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillMatch" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "jdAnalysisId" TEXT NOT NULL,
  "jdSkill" TEXT NOT NULL, "priority" "SkillPriority" NOT NULL, "matchType" "MatchType" NOT NULL,
  "profileMatch" TEXT, "similarity" DOUBLE PRECISION, "riskLevel" "RiskLevel" NOT NULL,
  "recommendedAction" TEXT NOT NULL, "needsUserDecision" BOOLEAN NOT NULL, "evidenceQuote" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SkillMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DecisionCard" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "cardType" "CardType" NOT NULL,
  "severity" "CardSeverity" NOT NULL, "status" "CardStatus" NOT NULL DEFAULT 'pending',
  "payload" JSONB NOT NULL, "autoResolvedOption" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DecisionCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserDecision" (
  "id" TEXT NOT NULL, "cardId" TEXT NOT NULL, "sessionId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL, "note" TEXT, "resolvedProvenance" "Provenance",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResumeStrategy" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "style" "ResumeStyle" NOT NULL DEFAULT 'balanced', "predictedMatchScore" INTEGER NOT NULL,
  "approved" BOOLEAN NOT NULL DEFAULT false, "promptVersion" TEXT, "modelUsed" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResumeStrategy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeneratedResume" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "activeVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GeneratedResume_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GeneratedResume_sessionId_key" ON "GeneratedResume"("sessionId");

CREATE TABLE "ResumeVersion" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "versionNo" INTEGER NOT NULL,
  "contentJson" JSONB NOT NULL, "createdBy" "CreatedBy" NOT NULL,
  "matchScore" INTEGER, "atsScore" INTEGER, "recruiterScore" INTEGER,
  "riskLevel" "RiskLevel", "screeningOutlook" "ScreeningOutlook", "validation" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResumeVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResumeVersion_sessionId_versionNo_key" ON "ResumeVersion"("sessionId","versionNo");

CREATE TABLE "ExportFile" (
  "id" TEXT NOT NULL, "versionId" TEXT NOT NULL, "format" "ExportFormat" NOT NULL,
  "storageKey" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'processing',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3),
  CONSTRAINT "ExportFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "role" TEXT NOT NULL, "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL, "sessionId" TEXT, "userId" TEXT, "eventType" TEXT NOT NULL,
  "fromState" "SessionState", "toState" "SessionState", "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResumeVisualStyle" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "config" JSONB NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResumeVisualStyle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResumeVisualStyle_key_key" ON "ResumeVisualStyle"("key");
-- Seed the four styles the profile form has always offered (keys are stable).
INSERT INTO "ResumeVisualStyle" ("id","key","name","description","config","isDefault","sortOrder") VALUES
  ('rvs_standard','standard','Standard','Clean and conservative — the safest choice for any application.','{"bodyFont":"system-sans","headingFont":"match","accentColor":"black","density":"normal","headerAlign":"centered","sectionTitleStyle":"underline","bulletMarker":"disc","nameScale":"normal","textScale":"normal","headerRule":"strong","skillsLayout":"inline","sectionOrder":["summary","skills","experience","education","certifications"]}',true,0),
  ('rvs_modern','modern','Modern','Left-aligned with navy accents, skill pills, and a bolder name.','{"bodyFont":"system-sans","headingFont":"match","accentColor":"navy","density":"normal","headerAlign":"left","sectionTitleStyle":"accent-bar","bulletMarker":"disc","nameScale":"large","textScale":"normal","headerRule":"accent","skillsLayout":"pills","sectionOrder":["summary","skills","experience","education","certifications"]}',false,1),
  ('rvs_minimal','minimal','Minimal','Compact and quiet — fits more on one page.','{"bodyFont":"system-sans","headingFont":"match","accentColor":"black","density":"compact","headerAlign":"left","sectionTitleStyle":"caps-spaced","bulletMarker":"dash","nameScale":"normal","textScale":"small","headerRule":"thin","skillsLayout":"inline","sectionOrder":["summary","skills","experience","education","certifications"]}',false,2),
  ('rvs_creative','creative','Creative','Serif headings, burgundy accents, arrow bullets, generous spacing.','{"bodyFont":"system-sans","headingFont":"georgia","accentColor":"burgundy","density":"airy","headerAlign":"centered","sectionTitleStyle":"accent-bar","bulletMarker":"arrow","nameScale":"large","textScale":"normal","headerRule":"accent","skillsLayout":"inline","sectionOrder":["summary","skills","experience","education","certifications"]}',false,3);

CREATE TABLE "SkillTaxonomy" (
  "id" TEXT NOT NULL, "skill" TEXT NOT NULL, "family" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "earliestYear" INTEGER,
  "sensitive" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "SkillTaxonomy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SkillTaxonomy_skill_key" ON "SkillTaxonomy"("skill");

CREATE TABLE "CategoryRelation" (
  "id" TEXT NOT NULL, "categoryA" TEXT NOT NULL, "categoryB" TEXT NOT NULL,
  "relation" "CategoryRelationKind" NOT NULL,
  CONSTRAINT "CategoryRelation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CategoryRelation_categoryA_categoryB_key" ON "CategoryRelation"("categoryA","categoryB");

CREATE TABLE "DecisionMemory" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "jdSkill" TEXT NOT NULL,
  "optionId" TEXT NOT NULL, "provenance" "Provenance" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisionMemory_pkey" PRIMARY KEY ("id")
);

-- Manager-curated certification library. The AI only ever SELECTS from these.
-- A cert can belong to several categories (e.g. AWS ML: Data Science + Software Engineering).
CREATE TABLE "CertificationCatalog" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "issuer" TEXT NOT NULL, "level" TEXT,
  "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "subtypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CertificationCatalog_pkey" PRIMARY KEY ("id")
);
-- Seed catalog. Categories/subtypes match PROFILE_CATEGORIES / PROFILE_SUBTYPES
-- (packages/shared/src/profile.ts) so the JD-side subtype filter lines up.
INSERT INTO "CertificationCatalog" ("id","name","issuer","level","categories","subtypes","aliases") VALUES
  ('cert_aws_saa','AWS Certified Solutions Architect - Associate','AWS','associate',ARRAY['Software Engineering'],ARRAY['Backend','DevOps','Full Stack'],ARRAY['AWS SAA','SAA-C03','Solutions Architect Associate']),
  ('cert_aws_dva','AWS Certified Developer - Associate','AWS','associate',ARRAY['Software Engineering'],ARRAY['Backend','Full Stack','DevOps'],ARRAY['AWS DVA','DVA-C02']),
  ('cert_aws_devops','AWS Certified DevOps Engineer - Professional','AWS','professional',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['AWS DOP','DOP-C02']),
  ('cert_aws_sysops','AWS Certified SysOps Administrator - Associate','AWS','associate',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['SOA-C02']),
  ('cert_az_204','Microsoft Certified: Azure Developer Associate','Microsoft','associate',ARRAY['Software Engineering'],ARRAY['Backend','Full Stack'],ARRAY['AZ-204','Azure Developer']),
  ('cert_az_104','Microsoft Certified: Azure Administrator Associate','Microsoft','associate',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['AZ-104','Azure Admin']),
  ('cert_az_305','Microsoft Certified: Azure Solutions Architect Expert','Microsoft','professional',ARRAY['Software Engineering'],ARRAY['Backend','DevOps'],ARRAY['AZ-305','Azure Architect']),
  ('cert_gcp_pca','Google Cloud Professional Cloud Architect','Google Cloud','professional',ARRAY['Software Engineering'],ARRAY['Backend','DevOps'],ARRAY['GCP PCA','Professional Cloud Architect']),
  ('cert_gcp_ace','Google Cloud Associate Cloud Engineer','Google Cloud','associate',ARRAY['Software Engineering'],ARRAY['DevOps','Backend'],ARRAY['GCP ACE','Associate Cloud Engineer']),
  ('cert_cka','Certified Kubernetes Administrator','CNCF','single',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['CKA','Kubernetes Administrator']),
  ('cert_ckad','Certified Kubernetes Application Developer','CNCF','single',ARRAY['Software Engineering'],ARRAY['DevOps','Backend'],ARRAY['CKAD']),
  ('cert_terraform','HashiCorp Certified: Terraform Associate','HashiCorp','associate',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['Terraform Associate','HashiCorp Terraform']),
  ('cert_dca','Docker Certified Associate','Docker','associate',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['DCA','Docker Associate']),
  ('cert_rhce','Red Hat Certified Engineer','Red Hat','professional',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['RHCE']),
  ('cert_meta_fe','Meta Front-End Developer Professional Certificate','Meta','single',ARRAY['Software Engineering'],ARRAY['Frontend','Full Stack'],ARRAY['Meta Frontend']),
  ('cert_jsnad','OpenJS Node.js Application Developer','OpenJS Foundation','single',ARRAY['Software Engineering'],ARRAY['Backend','Full Stack'],ARRAY['JSNAD','Node.js Developer']),
  ('cert_java_se','Oracle Certified Professional: Java SE Developer','Oracle','professional',ARRAY['Software Engineering'],ARRAY['Backend'],ARRAY['OCP Java','Java SE']),
  ('cert_mongo_dev','MongoDB Certified Developer Associate','MongoDB','associate',ARRAY['Software Engineering'],ARRAY['Backend','Full Stack'],ARRAY['MongoDB Developer']),
  ('cert_android','Google Associate Android Developer','Google','associate',ARRAY['Software Engineering'],ARRAY['Mobile'],ARRAY['Android Developer']),
  ('cert_security_plus','CompTIA Security+','CompTIA','single',ARRAY['Software Engineering'],ARRAY['DevOps','Backend'],ARRAY['Security Plus','SY0-701']),
  ('cert_cissp','Certified Information Systems Security Professional','(ISC)2','professional',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['CISSP']),
  ('cert_ceh','Certified Ethical Hacker','EC-Council','single',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['CEH']),
  ('cert_aws_sap','AWS Certified Solutions Architect - Professional','AWS','professional',ARRAY['Software Engineering'],ARRAY['Backend','DevOps'],ARRAY['AWS SAP','SAP-C02']),
  ('cert_aws_sec','AWS Certified Security - Specialty','AWS','specialty',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['AWS Security','SCS-C02']),
  ('cert_cks','Certified Kubernetes Security Specialist','CNCF','specialty',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['CKS']),
  ('cert_gcp_devops','Google Cloud Professional DevOps Engineer','Google Cloud','professional',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['GCP DevOps']),
  ('cert_az_400','Microsoft Certified: DevOps Engineer Expert','Microsoft','professional',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['AZ-400','Azure DevOps']),
  ('cert_spring','VMware Spring Professional','VMware','single',ARRAY['Software Engineering'],ARRAY['Backend'],ARRAY['Spring Professional','Spring Certified']),
  ('cert_elastic','Elastic Certified Engineer','Elastic','single',ARRAY['Software Engineering'],ARRAY['Backend','DevOps'],ARRAY['Elasticsearch Engineer']),
  ('cert_github_foundations','GitHub Foundations','GitHub','foundational',ARRAY['Software Engineering'],ARRAY['Frontend','Backend','Full Stack','DevOps'],ARRAY['GitHub Foundations']),
  ('cert_network_plus','CompTIA Network+','CompTIA','single',ARRAY['Software Engineering'],ARRAY['DevOps'],ARRAY['Network Plus','N10-009']),
  ('cert_meta_ios','Meta iOS Developer Professional Certificate','Meta','single',ARRAY['Software Engineering'],ARRAY['Mobile'],ARRAY['Meta iOS','iOS Developer']),
  ('cert_aws_ml','AWS Certified Machine Learning - Specialty','AWS','specialty',ARRAY['Data Science','Software Engineering'],ARRAY['ML Engineer','Research','Backend'],ARRAY['AWS ML','MLS-C01']),
  ('cert_gcp_mle','Google Cloud Professional Machine Learning Engineer','Google Cloud','professional',ARRAY['Data Science','Software Engineering'],ARRAY['ML Engineer','Backend'],ARRAY['GCP PMLE']),
  ('cert_dp_100','Microsoft Certified: Azure Data Scientist Associate','Microsoft','associate',ARRAY['Data Science'],ARRAY['ML Engineer','Research'],ARRAY['DP-100','Azure Data Scientist']),
  ('cert_tf_dev','TensorFlow Developer Certificate','Google','single',ARRAY['Data Science','Software Engineering'],ARRAY['ML Engineer','Research','Backend'],ARRAY['TensorFlow Developer','TF Developer']),
  ('cert_databricks_ml','Databricks Certified Machine Learning Associate','Databricks','associate',ARRAY['Data Science'],ARRAY['ML Engineer'],ARRAY['Databricks ML']),
  ('cert_dp_203','Microsoft Certified: Azure Data Engineer Associate','Microsoft','associate',ARRAY['Data Science','Software Engineering'],ARRAY['Analytics','Data Analyst','Backend'],ARRAY['DP-203','Azure Data Engineer']),
  ('cert_gcp_pde','Google Cloud Professional Data Engineer','Google Cloud','professional',ARRAY['Data Science','Software Engineering'],ARRAY['Analytics','ML Engineer','Backend'],ARRAY['GCP PDE']),
  ('cert_databricks_de','Databricks Certified Data Engineer Associate','Databricks','associate',ARRAY['Data Science','Software Engineering'],ARRAY['Analytics','Backend'],ARRAY['Databricks Data Engineer']),
  ('cert_snowpro','SnowPro Core Certification','Snowflake','single',ARRAY['Data Science'],ARRAY['Analytics','Data Analyst'],ARRAY['SnowPro']),
  ('cert_pl_300','Microsoft Certified: Power BI Data Analyst Associate','Microsoft','associate',ARRAY['Data Science'],ARRAY['Data Analyst','Analytics'],ARRAY['PL-300','Power BI']),
  ('cert_tableau','Tableau Desktop Specialist','Tableau','single',ARRAY['Data Science'],ARRAY['Data Analyst','Analytics'],ARRAY['Tableau']),
  ('cert_aws_da','AWS Certified Data Analytics - Specialty','AWS','specialty',ARRAY['Data Science'],ARRAY['Analytics','Data Analyst'],ARRAY['AWS Data Analytics','DAS-C01']),
  ('cert_databricks_da','Databricks Certified Data Analyst Associate','Databricks','associate',ARRAY['Data Science'],ARRAY['Data Analyst','Analytics'],ARRAY['Databricks Data Analyst']),
  ('cert_databricks_mlp','Databricks Certified Machine Learning Professional','Databricks','professional',ARRAY['Data Science'],ARRAY['ML Engineer'],ARRAY['Databricks ML Professional']),
  ('cert_dp_600','Microsoft Certified: Fabric Analytics Engineer Associate','Microsoft','associate',ARRAY['Data Science'],ARRAY['Analytics','Data Analyst'],ARRAY['DP-600','Fabric Analytics']),
  ('cert_ibm_ds','IBM Data Science Professional Certificate','IBM','single',ARRAY['Data Science'],ARRAY['Data Analyst','ML Engineer'],ARRAY['IBM Data Science']),
  ('cert_google_ada','Google Advanced Data Analytics Professional Certificate','Google','single',ARRAY['Data Science'],ARRAY['Data Analyst','Analytics'],ARRAY['Google Advanced Data Analytics']),
  ('cert_snowpro_ds','SnowPro Advanced: Data Scientist','Snowflake','professional',ARRAY['Data Science'],ARRAY['ML Engineer','Analytics'],ARRAY['SnowPro Data Scientist']),
  ('cert_dbt','dbt Analytics Engineering Certification','dbt Labs','single',ARRAY['Data Science','Software Engineering'],ARRAY['Analytics','Data Analyst','Backend'],ARRAY['dbt','dbt Analytics Engineer']),
  ('cert_sas_ds','SAS Certified Data Scientist','SAS','professional',ARRAY['Data Science'],ARRAY['ML Engineer','Research'],ARRAY['SAS Data Scientist']),
  ('cert_cspo','Certified Scrum Product Owner','Scrum Alliance','single',ARRAY['Product Management'],ARRAY['PM','Technical PM'],ARRAY['CSPO']),
  ('cert_pspo','Professional Scrum Product Owner','Scrum.org','single',ARRAY['Product Management'],ARRAY['PM','APM'],ARRAY['PSPO']),
  ('cert_pragmatic','Pragmatic Institute Certified','Pragmatic Institute','single',ARRAY['Product Management'],ARRAY['PM','Strategy'],ARRAY['PMC']),
  ('cert_safe_popm','SAFe Product Owner/Product Manager','Scaled Agile','single',ARRAY['Product Management'],ARRAY['Technical PM','PM'],ARRAY['SAFe POPM']),
  ('cert_nng_ux','Nielsen Norman Group UX Certification','NN/g','single',ARRAY['Design'],ARRAY['UX','Product Designer'],ARRAY['NN/g UX','NNG UX']),
  ('cert_google_ux','Google UX Design Professional Certificate','Google','single',ARRAY['Design'],ARRAY['UX','UI','Product Designer'],ARRAY['Google UX']),
  ('cert_adobe_acp','Adobe Certified Professional','Adobe','single',ARRAY['Design'],ARRAY['Visual','UI'],ARRAY['ACP','Adobe Certified']),
  ('cert_sf_admin','Salesforce Certified Administrator','Salesforce','single',ARRAY['Sales'],ARRAY['Enterprise','Inside Sales'],ARRAY['SF Admin','ADM-201']),
  ('cert_sf_sales','Salesforce Certified Sales Cloud Consultant','Salesforce','single',ARRAY['Sales'],ARRAY['Enterprise'],ARRAY['Sales Cloud']),
  ('cert_hubspot_sales','HubSpot Sales Software Certification','HubSpot','single',ARRAY['Sales'],ARRAY['SMB','Inside Sales'],ARRAY['HubSpot Sales']),
  ('cert_google_ads','Google Ads Certification','Google','single',ARRAY['Marketing'],ARRAY['Performance','Growth'],ARRAY['Google Ads']),
  ('cert_google_analytics','Google Analytics Certification','Google','single',ARRAY['Marketing'],ARRAY['Growth','Performance'],ARRAY['GA4','Google Analytics']),
  ('cert_hubspot_inbound','HubSpot Inbound Marketing Certification','HubSpot','single',ARRAY['Marketing'],ARRAY['Content','Growth'],ARRAY['HubSpot Inbound']),
  ('cert_meta_blueprint','Meta Certified Digital Marketing Associate','Meta','single',ARRAY['Marketing'],ARRAY['Performance','Growth'],ARRAY['Meta Blueprint']),
  ('cert_pmp','Project Management Professional','PMI','professional',ARRAY['Operations'],ARRAY['Supply Chain','IT Ops'],ARRAY['PMP']),
  ('cert_itil','ITIL 4 Foundation','Axelos','foundational',ARRAY['Operations'],ARRAY['IT Ops'],ARRAY['ITIL','ITIL 4']),
  ('cert_cscp','Certified Supply Chain Professional','ASCM','professional',ARRAY['Operations'],ARRAY['Supply Chain'],ARRAY['CSCP']),
  ('cert_lssgb','Lean Six Sigma Green Belt','ASQ','single',ARRAY['Operations'],ARRAY['Supply Chain','IT Ops'],ARRAY['LSSGB','Six Sigma Green Belt']),
  ('cert_cpa','Certified Public Accountant','AICPA','professional',ARRAY['Finance'],ARRAY['Accounting'],ARRAY['CPA']),
  ('cert_cfa','Chartered Financial Analyst','CFA Institute','professional',ARRAY['Finance'],ARRAY['Investment','Trading'],ARRAY['CFA']),
  ('cert_cma','Certified Management Accountant','IMA','professional',ARRAY['Finance'],ARRAY['FP&A','Accounting'],ARRAY['CMA']),
  ('cert_fmva','Financial Modeling and Valuation Analyst','CFI','single',ARRAY['Finance'],ARRAY['FP&A','Investment'],ARRAY['FMVA']),
  ('cert_frm','Financial Risk Manager','GARP','professional',ARRAY['Finance'],ARRAY['Trading','Investment'],ARRAY['FRM']),
  ('cert_phr','Professional in Human Resources','HRCI','single',ARRAY['Human Resources'],ARRAY['HRBP','Recruiter'],ARRAY['PHR']),
  ('cert_shrm_cp','SHRM Certified Professional','SHRM','single',ARRAY['Human Resources'],ARRAY['HRBP','Recruiter'],ARRAY['SHRM-CP']),
  ('cert_ccp','Certified Compensation Professional','WorldatWork','single',ARRAY['Human Resources'],ARRAY['Compensation'],ARRAY['CCP']),
  ('cert_aptd','Associate Professional in Talent Development','ATD','single',ARRAY['Human Resources'],ARRAY['Learning'],ARRAY['APTD']);

-- User-requested certs missing from the catalog → the manager's to-do list.
CREATE TABLE "CertificationTodo" (
  "id" TEXT NOT NULL, "rawText" TEXT NOT NULL, "issuer" TEXT, "category" TEXT, "subtype" TEXT,
  "requestedBy" TEXT, "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CertificationTodo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CertificationTodo_status_idx" ON "CertificationTodo"("status");

-- Managed role taxonomy (Category -> Subtype; a `family` mid-level comes later).
-- One unified source for the profile form, the JD-analysis prompt, and cert pickers.
CREATE TABLE "TaxonomyCategory" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxonomyCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaxonomyCategory_name_key" ON "TaxonomyCategory"("name");

CREATE TABLE "TaxonomyFamily" (
  "id" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 100, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxonomyFamily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaxonomyFamily_categoryId_name_key" ON "TaxonomyFamily"("categoryId","name");
CREATE INDEX "TaxonomyFamily_categoryId_idx" ON "TaxonomyFamily"("categoryId");

CREATE TABLE "TaxonomySubtype" (
  "id" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "familyId" TEXT, "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 100, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxonomySubtype_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaxonomySubtype_categoryId_name_key" ON "TaxonomySubtype"("categoryId","name");
CREATE INDEX "TaxonomySubtype_categoryId_idx" ON "TaxonomySubtype"("categoryId");
CREATE INDEX "TaxonomySubtype_familyId_idx" ON "TaxonomySubtype"("familyId");

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
  ('cat_civil','Civil/Mechanical Engineering',110);

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
  ('sub_civil_mechanical','cat_civil','Mechanical',30);

-- Optional family grouping (Healthcare + Civil left ungrouped — only 3 subtypes each).
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
  ('fam_hr_rewards','cat_hr','Rewards & Development',20);

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
