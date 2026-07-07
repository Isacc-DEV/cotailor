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
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "name" TEXT NOT NULL, "issuer" TEXT,
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
