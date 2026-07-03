# CoTailor Database Reference Guide

> Complete guide to the PostgreSQL schema, common queries, and data operations.

---

## Quick Start

### View Current Schema
```bash
# Connect to local Postgres
psql -h 127.0.0.1 -p 5433 -U cotailor -d cotailor

# List all tables
\dt

# View schema for a specific table
\d table_name

# View all enum types
\dT+
```

### Initialize Database (First Time)
```bash
# Option 1: Direct SQL initialization (used on this machine)
psql -h 127.0.0.1 -p 5433 -U cotailor -d cotailor -f apps/api/prisma/init.sql

# Option 2: Prisma migration (on normal machines)
pnpm run prisma:generate   # Generate types
pnpm run prisma:migrate    # Run migrations
```

### Generate Prisma Client Types
```bash
pnpm run prisma:generate
# Outputs: apps/api/.prisma/client/
```

---

## Schema Overview

### 17 Tables (Organized by Domain)

#### User & Profile Management (4 tables)
| Table | Purpose |
|-------|---------|
| `User` | User accounts and credentials |
| `Profile` | Saved resume profiles (source of truth for a user's experience) |
| `ProfileSkill` | Skills attached to a profile |
| `ProfileCertification` | Certifications attached to a profile |

#### Session & Workflow (5 tables)
| Table | Purpose |
|-------|---------|
| `Session` | Main unit of work; ties profile + JD analysis + state |
| `Card` | Decision card instances; user choices |
| `SkillMatch` | Result of matching JD skills to profile skills |
| `Strategy` | User-approved tailoring strategy |
| `SessionEvent` | Immutable audit log of session actions |

#### Analysis & Output (6 tables)
| Table | Purpose |
|-------|---------|
| `JDAnalysis` | Extracted structure from job description |
| `Resume` | Generated resume (structured JSON + metadata) |
| `ValidationResult` | Resume validation scores and warnings |
| `ExportLog` | Audit trail of resume exports |
| (Future: Chat edits, revisions) | |

---

## Table Definitions

### User
```sql
CREATE TABLE "User" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  passwordHash VARCHAR(255),  -- hashed; never plain text
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key Fields:**
- `id` — Unique identifier
- `email` — User's email (login credential)
- `name` — Display name
- `passwordHash` — Argon2 or bcrypt hash (never store plain text)

**Common Queries:**
```sql
-- Find user by email
SELECT * FROM "User" WHERE email = 'user@example.com';

-- Count users
SELECT COUNT(*) FROM "User";

-- Update user profile
UPDATE "User" SET name = 'New Name', updatedAt = CURRENT_TIMESTAMP WHERE id = $1;
```

---

### Profile
```sql
CREATE TABLE "Profile" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,  -- e.g., "Software Engineering"
  seniority Seniority NOT NULL,    -- enum: intern, junior, mid, senior, lead, staff, principal, manager_plus
  baseResume TEXT,                 -- Markdown or HTML of base resume
  workAuthorization VARCHAR(50),   -- e.g., "US", "EU", "Any"
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_profile_per_user_name UNIQUE (userId, name)
);
```

**Key Fields:**
- `userId` — Owner of this profile
- `name` — Profile display name (e.g., "Backend Engineer — Node.js")
- `category` — Job category (from CATEGORY enum or string)
- `seniority` — Career level (from Seniority enum)
- `baseResume` — The canonical resume text (source of truth)
- `workAuthorization` — Work eligibility info

**Common Queries:**
```sql
-- List all profiles for a user
SELECT * FROM "Profile" WHERE userId = $1 ORDER BY createdAt DESC;

-- Create a profile
INSERT INTO "Profile" (userId, name, category, seniority, baseResume, workAuthorization)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- Update profile
UPDATE "Profile" SET baseResume = $1, updatedAt = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;

-- Delete profile (cascades to sessions, cards, etc.)
DELETE FROM "Profile" WHERE id = $1 AND userId = $2;

-- Check profile count per user
SELECT userId, COUNT(*) FROM "Profile" GROUP BY userId;
```

---

### ProfileSkill
```sql
CREATE TABLE "ProfileSkill" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profileId UUID NOT NULL REFERENCES "Profile"(id) ON DELETE CASCADE,
  skill VARCHAR(100) NOT NULL,  -- e.g., "Node.js", "PostgreSQL", "React"
  proficiency VARCHAR(50),       -- e.g., "expert", "intermediate", "beginner"
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_skill_per_profile UNIQUE (profileId, skill)
);
```

**Key Fields:**
- `profileId` — Parent profile
- `skill` — Skill name (canonical; matches JD skill extraction)
- `proficiency` — Optional proficiency level

**Common Queries:**
```sql
-- Get all skills for a profile
SELECT skill, proficiency FROM "ProfileSkill" WHERE profileId = $1;

-- Add a skill
INSERT INTO "ProfileSkill" (profileId, skill, proficiency) VALUES ($1, $2, $3);

-- Check if profile has a skill
SELECT 1 FROM "ProfileSkill" WHERE profileId = $1 AND skill = $2 LIMIT 1;

-- Remove a skill
DELETE FROM "ProfileSkill" WHERE profileId = $1 AND skill = $2;
```

---

### Session
```sql
CREATE TABLE "Session" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profileId UUID NOT NULL REFERENCES "Profile"(id),
  userId UUID NOT NULL REFERENCES "User"(id),
  state SessionState NOT NULL,         -- enum: CREATED, JD_SUBMITTED, ANALYZING, ...
  jdText TEXT,                         -- Original JD text submitted by user
  jdHash VARCHAR(64),                  -- SHA-256 hash for caching
  jdAnalysisId UUID REFERENCES "JDAnalysis"(id),  -- Extracted JD structure
  profileSnapshot JSONB,               -- Snapshot of profile at session creation (immutable)
  pendingCardCount INT DEFAULT 0,      -- Count of unanswered cards
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiresAt TIMESTAMP,                 -- Optional: session expires if not completed
  
  CONSTRAINT valid_state CHECK (state IN (...))
);

-- Index for fast lookups
CREATE INDEX idx_session_user_state ON "Session"(userId, state);
CREATE INDEX idx_session_profile ON "Session"(profileId);
CREATE INDEX idx_session_created ON "Session"(createdAt DESC);
```

**Key Fields:**
- `profileId` — Which profile is being tailored
- `userId` — Whose session is it
- `state` — Current workflow state (enforced by backend)
- `jdText` — Original job description (stored for audit + regeneration)
- `jdHash` — Hash of JD for cache lookup (avoid re-analyzing same JD)
- `jdAnalysisId` — FK to extracted JD analysis
- `profileSnapshot` — Immutable snapshot of profile at session start (if profile is edited, session still uses original)
- `pendingCardCount` — Cached count for fast queries
- `expiresAt` — Sessions can expire if not completed in time (future)

**Common Queries:**
```sql
-- Get a session with full context
SELECT s.*, p.name as profileName, u.email as userEmail, jda.category as jdCategory
FROM "Session" s
JOIN "Profile" p ON s.profileId = p.id
JOIN "User" u ON s.userId = u.id
LEFT JOIN "JDAnalysis" jda ON s.jdAnalysisId = jda.id
WHERE s.id = $1;

-- List user's sessions (for session history)
SELECT id, profileId, state, createdAt, updatedAt FROM "Session"
WHERE userId = $1
ORDER BY createdAt DESC
LIMIT 20;

-- Count sessions by state
SELECT state, COUNT(*) FROM "Session" WHERE userId = $1 GROUP BY state;

-- Get sessions in progress (not terminal)
SELECT * FROM "Session"
WHERE userId = $1 AND state NOT IN ('CATEGORY_REJECTED', 'FINAL_READY', 'CANCELLED', 'EXPIRED')
ORDER BY updatedAt DESC;

-- Update session state
UPDATE "Session" SET state = $1, updatedAt = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;

-- Expire old sessions
UPDATE "Session" SET state = 'EXPIRED' WHERE expiresAt < CURRENT_TIMESTAMP AND state NOT IN ('FINAL_READY', 'CANCELLED');
```

---

### Card (Decision Cards)
```sql
CREATE TABLE "Card" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessionId UUID NOT NULL REFERENCES "Session"(id) ON DELETE CASCADE,
  type CardType NOT NULL,             -- enum: missing_required_skill, subtype_mismatch, seniority_gap, ...
  severity CardSeverity NOT NULL,     -- enum: info, warning, blocking, critical
  status CardStatus NOT NULL,         -- enum: pending, answered, auto_resolved, expired
  data JSONB,                         -- Card-specific data (question, context, options)
  userResponse JSONB,                 -- User's answer (depends on card type)
  consequence TEXT,                   -- What happens if user chooses X option
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  answeredAt TIMESTAMP,
  
  CONSTRAINT valid_type CHECK (type IN (...))
);

-- Index for fast lookups
CREATE INDEX idx_card_session_status ON "Card"(sessionId, status);
```

**Key Fields:**
- `sessionId` — Which session this card belongs to
- `type` — Card type (missing_required_skill, seniority_gap, etc.)
- `severity` — Importance level
- `status` — pending → answered | auto_resolved | expired
- `data` — JSONB with card-specific fields (question text, options, context)
- `userResponse` — User's choice (e.g., "skills_only", "omit", "cancel")
- `consequence` — What the choice means (shown to user)

**Card Data Example (missing_required_skill):**
```json
{
  "jdSkill": "Kubernetes",
  "reason": "required",
  "context": "The job explicitly requires Kubernetes experience.",
  "options": ["skills_only", "omit", "cancel"],
  "riskLevel": "high"
}
```

**Common Queries:**
```sql
-- Get all pending cards for a session
SELECT * FROM "Card"
WHERE sessionId = $1 AND status = 'pending'
ORDER BY severity DESC, createdAt;

-- Answer a card
UPDATE "Card"
SET status = 'answered', userResponse = $1, answeredAt = CURRENT_TIMESTAMP
WHERE id = $2 AND sessionId = $3
RETURNING *;

-- Count unanswered cards per session
SELECT COUNT(*) FROM "Card" WHERE sessionId = $1 AND status = 'pending';

-- Get all answered cards (for strategy generation)
SELECT * FROM "Card"
WHERE sessionId = $1 AND status IN ('answered', 'auto_resolved')
ORDER BY createdAt;

-- Auto-resolve a low-stakes card
UPDATE "Card"
SET status = 'auto_resolved', consequence = 'Preferred skill gap → Will omit from resume'
WHERE id = $1
RETURNING *;
```

---

### JDAnalysis
```sql
CREATE TABLE "JDAnalysis" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jdHash VARCHAR(64) UNIQUE NOT NULL,  -- SHA-256 hash of JD text (for caching)
  category VARCHAR(100),               -- Detected job category (e.g., "Software Engineering")
  categoryConfidence DECIMAL(3,2),     -- 0.0–1.0 confidence in category detection
  subtype VARCHAR(100),                -- Detected job subtype (e.g., "Backend")
  seniority Seniority,                 -- Required seniority level
  requiredSkills JSONB,                -- Array of required skills with priority
  preferredSkills JSONB,               -- Array of preferred skills
  tools JSONB,                         -- Tools/frameworks mentioned
  responsibilities TEXT,               -- Key responsibilities (summary)
  certifications JSONB,                -- Required certifications
  knockoutRequirements JSONB,          -- Non-negotiable requirements (work auth, location, etc.)
  domainKeywords TEXT[],               -- Domain-specific keywords (fintech, healthcare, etc.)
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_confidence CHECK (categoryConfidence >= 0 AND categoryConfidence <= 1)
);

-- Index for cache lookups
CREATE INDEX idx_jd_hash ON "JDAnalysis"(jdHash);
```

**Key Fields:**
- `jdHash` — Hash of input JD (enables caching; same JD = cache hit)
- `category` — Extracted job category
- `categoryConfidence` — How confident is the extraction (used for gates)
- `subtype` — Extracted job subtype
- `seniority` — Required seniority level
- `requiredSkills` — Array of skills + priority
- `preferredSkills` — Optional-to-have skills
- `knockoutRequirements` — Non-negotiable items (work auth, location, min years, etc.)

**Example Data (requiredSkills):**
```json
[
  { "skill": "Node.js", "priority": "required", "confidence": 0.95 },
  { "skill": "PostgreSQL", "priority": "required", "confidence": 0.88 },
  { "skill": "Docker", "priority": "required", "confidence": 0.82 }
]
```

**Common Queries:**
```sql
-- Check if JD has been analyzed before (cache hit)
SELECT * FROM "JDAnalysis" WHERE jdHash = $1;

-- Get analysis for a session
SELECT jda.* FROM "JDAnalysis" jda
JOIN "Session" s ON s.jdAnalysisId = jda.id
WHERE s.id = $1;

-- List all unique JDs analyzed (for stats)
SELECT COUNT(*) FROM "JDAnalysis";
```

---

### SkillMatch
```sql
CREATE TABLE "SkillMatch" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessionId UUID NOT NULL REFERENCES "Session"(id) ON DELETE CASCADE,
  jdSkill VARCHAR(100) NOT NULL,      -- Skill required by JD
  profileSkill VARCHAR(100),          -- Matching skill in profile (if any)
  matchType MatchType NOT NULL,       -- enum: exact, equivalent, similar_stack, same_family, missing, blocked_sensitive
  riskLevel RiskLevel NOT NULL,       -- enum: none, low, medium, high, critical
  actionRecommendation VARCHAR(100),  -- Recommended action (skills_only, add_bullet, omit, etc.)
  requiresUserDecision BOOLEAN,       -- Does this need a card?
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_match CHECK (matchType IN (...))
);

-- Index for lookups
CREATE INDEX idx_skill_match_session ON "SkillMatch"(sessionId);
```

**Key Fields:**
- `jdSkill` — Required skill from JD
- `profileSkill` — Matching skill from profile (null if missing)
- `matchType` — Result of match (exact = perfect match, equivalent = basically same, etc.)
- `riskLevel` — How risky is this skill gap?
- `actionRecommendation` — What should be done (add to Skills section, create new bullet, omit, etc.)
- `requiresUserDecision` — If true, raise a card on Decision Board

**Common Queries:**
```sql
-- Get all skill matches for a session
SELECT * FROM "SkillMatch" WHERE sessionId = $1 ORDER BY riskLevel DESC;

-- Count matches by type
SELECT matchType, COUNT(*) FROM "SkillMatch"
WHERE sessionId = $1
GROUP BY matchType;

-- Get skills requiring user decision
SELECT * FROM "SkillMatch"
WHERE sessionId = $1 AND requiresUserDecision = true
ORDER BY riskLevel DESC;
```

---

### Strategy
```sql
CREATE TABLE "Strategy" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessionId UUID NOT NULL REFERENCES "Session"(id) ON DELETE CASCADE,
  targetTitle VARCHAR(255),           -- Proposed job title for tailored resume
  emphasis TEXT[],                    -- Bullet points to emphasize
  avoid TEXT[],                       -- Bullet points to de-emphasize or omit
  perRolePlan TEXT,                   -- Narrative description of tailoring approach
  style ResumeStyle NOT NULL,         -- enum: ats_strong, recruiter_friendly, balanced
  assumedDefaults JSONB,              -- Auto-resolved cards + their defaults
  predictedScore INT,                 -- Predicted match score (0–100)
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approvedAt TIMESTAMP,               -- When user approved this strategy
  
  CONSTRAINT valid_score CHECK (predictedScore >= 0 AND predictedScore <= 100)
);

CREATE INDEX idx_strategy_session ON "Strategy"(sessionId);
```

**Key Fields:**
- `targetTitle` — What the resume should claim as the candidate's title
- `emphasis` / `avoid` — Tailoring direction (what to highlight, what to downplay)
- `perRolePlan` — Human-readable plan
- `style` — How to format the resume
- `assumedDefaults` — Record of auto-resolved card choices
- `predictedScore` — Estimated match score (0–100)
- `approvedAt` — When user approved (null = pending approval)

**Common Queries:**
```sql
-- Get strategy for a session
SELECT * FROM "Strategy" WHERE sessionId = $1;

-- Approve a strategy
UPDATE "Strategy" SET approvedAt = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *;

-- Check if strategy is approved
SELECT approvedAt IS NOT NULL as approved FROM "Strategy" WHERE sessionId = $1;
```

---

### Resume
```sql
CREATE TABLE "Resume" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessionId UUID NOT NULL REFERENCES "Session"(id) ON DELETE CASCADE,
  contentJson JSONB NOT NULL,         -- Structured resume (sections, bullets, provenance)
  wordCount INT,                      -- Total word count
  generatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_resume_per_session UNIQUE (sessionId)
);

CREATE INDEX idx_resume_session ON "Resume"(sessionId);
```

**Key Fields:**
- `contentJson` — Full resume structure (see below)
- `wordCount` — Metadata for validation

**contentJson Structure Example:**
```json
{
  "profile": {
    "name": "Alex",
    "title": "Senior Backend Engineer — Node.js",
    "summary": "..."
  },
  "experience": [
    {
      "company": "TechCo",
      "title": "Senior Engineer",
      "duration": "2020–Present",
      "bullets": [
        {
          "text": "Designed distributed payment system handling 10M+ txn/day",
          "provenance": "profile_verified"
        },
        {
          "text": "Led microservices migration from monolith",
          "provenance": "user_confirmed"
        }
      ]
    }
  ],
  "skills": {
    "languages": ["JavaScript", "TypeScript", "Python"],
    "frameworks": ["Node.js", "Express"],
    "databases": ["PostgreSQL", "Redis"],
    "tools": ["Docker", "Kubernetes"]
  },
  "education": [...],
  "certifications": [...]
}
```

**Common Queries:**
```sql
-- Get resume for a session
SELECT * FROM "Resume" WHERE sessionId = $1;

-- Get word count
SELECT wordCount FROM "Resume" WHERE sessionId = $1;

-- Delete resume (if regenerating)
DELETE FROM "Resume" WHERE sessionId = $1;
```

---

### ValidationResult
```sql
CREATE TABLE "ValidationResult" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resumeId UUID NOT NULL REFERENCES "Resume"(id) ON DELETE CASCADE,
  contentCheckPassed BOOLEAN,         -- Did validation pass (no unsupported claims)?
  atsScore INT,                       -- ATS scanner score (0–100)
  recruiterReadabilityScore INT,      -- Readability score (0–100)
  warnings TEXT[],                    -- List of warnings (not errors; resume is still valid)
  completedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_validation_per_resume UNIQUE (resumeId)
);

CREATE INDEX idx_validation_resume ON "ValidationResult"(resumeId);
```

**Key Fields:**
- `contentCheckPassed` — Did it pass the honesty check (no fabricated claims)?
- `atsScore` — How well will ATS software parse it?
- `recruiterReadabilityScore` — How readable is it for humans?
- `warnings` — List of non-critical issues

**Common Queries:**
```sql
-- Get validation results for a resume
SELECT * FROM "ValidationResult" WHERE resumeId = $1;

-- Get validation for a session
SELECT vr.* FROM "ValidationResult" vr
JOIN "Resume" r ON vr.resumeId = r.id
WHERE r.sessionId = $1;

-- Check if resume passed validation
SELECT contentCheckPassed FROM "ValidationResult"
WHERE resumeId = (SELECT id FROM "Resume" WHERE sessionId = $1);
```

---

### SessionEvent (Audit Log)
```sql
CREATE TABLE "SessionEvent" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessionId UUID NOT NULL REFERENCES "Session"(id) ON DELETE CASCADE,
  eventType VARCHAR(50) NOT NULL,     -- e.g., "STATE_TRANSITION", "CARD_ANSWERED", "STRATEGY_APPROVED"
  eventData JSONB,                    -- Event-specific data (from: state, to: state, etc.)
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_event_type CHECK (eventType IN (...))
);

-- Index for lookups
CREATE INDEX idx_session_event_session ON "SessionEvent"(sessionId);
CREATE INDEX idx_session_event_type ON "SessionEvent"(eventType);
CREATE INDEX idx_session_event_created ON "SessionEvent"(createdAt DESC);
```

**Key Fields:**
- `eventType` — What happened (STATE_TRANSITION, CARD_ANSWERED, etc.)
- `eventData` — Event-specific payload

**Event Data Examples:**
```json
// STATE_TRANSITION event
{ "from": "CREATED", "to": "JD_SUBMITTED", "timestamp": "2026-07-03T12:34:56Z" }

// CARD_ANSWERED event
{ "cardId": "card-123", "type": "missing_required_skill", "response": "skills_only" }

// STRATEGY_APPROVED event
{ "strategyId": "strat-456", "predictedScore": 83 }
```

**Common Queries:**
```sql
-- Get full audit log for a session
SELECT * FROM "SessionEvent" WHERE sessionId = $1 ORDER BY createdAt;

-- Get state transitions only
SELECT * FROM "SessionEvent"
WHERE sessionId = $1 AND eventType = 'STATE_TRANSITION'
ORDER BY createdAt;

-- Replay session actions
SELECT eventType, eventData FROM "SessionEvent"
WHERE sessionId = $1
ORDER BY createdAt;
```

---

### ExportLog
```sql
CREATE TABLE "ExportLog" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resumeId UUID NOT NULL REFERENCES "Resume"(id),
  format VARCHAR(20),                 -- "docx", "pdf", "json"
  downloadUrl VARCHAR(500),           -- S3 URL or temp download link
  userAgent VARCHAR(500),             -- Browser info
  exportedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_export_resume ON "ExportLog"(resumeId);
```

**Key Fields:**
- `resumeId` — Which resume was exported
- `format` — Export format (DOCX, PDF, JSON)
- `downloadUrl` — Where the file is stored
- `userAgent` — Browser/client info (for analytics)

**Common Queries:**
```sql
-- Get export history for a resume
SELECT * FROM "ExportLog" WHERE resumeId = $1 ORDER BY exportedAt DESC;

-- Count exports by format
SELECT format, COUNT(*) FROM "ExportLog" GROUP BY format;

-- Find unused exports (for cleanup)
SELECT * FROM "ExportLog" WHERE exportedAt < NOW() - INTERVAL '30 days';
```

---

## Enums (Database Types)

### SessionState
```sql
CREATE TYPE SessionState AS ENUM (
  'CREATED',
  'JD_SUBMITTED',
  'ANALYZING',
  'CATEGORY_REJECTED',
  'WAITING_CATEGORY_CONFIRMATION',
  'WAITING_SUBTYPE_CONFIRMATION',
  'WAITING_SKILL_DECISIONS',
  'STRATEGY_REVIEW',
  'GENERATING',
  'VALIDATING',
  'NEEDS_REVISION',
  'FINAL_READY',
  'REVISING',
  'CANCELLED',
  'EXPIRED'
);
```

### Seniority
```sql
CREATE TYPE Seniority AS ENUM (
  'intern',
  'junior',
  'mid',
  'senior',
  'lead',
  'staff',
  'principal',
  'manager_plus'
);
```

### CardType
```sql
CREATE TYPE CardType AS ENUM (
  'category_mismatch',
  'category_low_confidence',
  'subtype_mismatch',
  'seniority_gap',
  'knockout_requirement',
  'missing_required_skill',
  'similar_skill',
  'certification_risk',
  'resume_style',
  'strategy_approval'
);
```

### CardSeverity
```sql
CREATE TYPE CardSeverity AS ENUM (
  'info',
  'warning',
  'blocking',
  'critical'
);
```

### CardStatus
```sql
CREATE TYPE CardStatus AS ENUM (
  'pending',
  'answered',
  'auto_resolved',
  'expired'
);
```

### MatchType
```sql
CREATE TYPE MatchType AS ENUM (
  'exact',
  'equivalent',
  'similar_stack',
  'same_family',
  'missing',
  'blocked_sensitive'
);
```

### RiskLevel
```sql
CREATE TYPE RiskLevel AS ENUM (
  'none',
  'low',
  'medium',
  'high',
  'critical'
);
```

### ResumeStyle
```sql
CREATE TYPE ResumeStyle AS ENUM (
  'ats_strong',
  'recruiter_friendly',
  'balanced'
);
```

### Provenance
```sql
CREATE TYPE Provenance AS ENUM (
  'profile_verified',
  'user_confirmed',
  'omitted'
);
```

---

## Common Patterns

### Get Full Session Context
```sql
SELECT
  s.id, s.state, s.createdAt,
  p.name as profile_name, p.category, p.seniority,
  u.email as user_email,
  jda.category as jd_category, jda.seniority as jd_seniority,
  COUNT(c.id) as pending_cards
FROM "Session" s
JOIN "Profile" p ON s.profileId = p.id
JOIN "User" u ON s.userId = u.id
LEFT JOIN "JDAnalysis" jda ON s.jdAnalysisId = jda.id
LEFT JOIN "Card" c ON s.id = c.sessionId AND c.status = 'pending'
WHERE s.id = $1
GROUP BY s.id, p.id, u.id, jda.id;
```

### Get Session with All Related Data
```sql
WITH session_data AS (
  SELECT s.*, p.name as profile_name, p.category
  FROM "Session" s
  JOIN "Profile" p ON s.profileId = p.id
  WHERE s.id = $1
),
cards_data AS (
  SELECT sessionId, COUNT(*) as pending_count
  FROM "Card"
  WHERE sessionId = $1 AND status = 'pending'
  GROUP BY sessionId
)
SELECT sd.*, cd.pending_count
FROM session_data sd
LEFT JOIN cards_data cd ON sd.id = cd.sessionId;
```

### List All Skills in a Profile
```sql
SELECT
  p.name as profile_name,
  ARRAY_AGG(ps.skill ORDER BY ps.createdAt) as skills
FROM "Profile" p
LEFT JOIN "ProfileSkill" ps ON p.id = ps.profileId
WHERE p.id = $1
GROUP BY p.id;
```

### Get Session History for User
```sql
SELECT
  s.id, s.state, s.createdAt,
  p.name as profile_name,
  (SELECT COUNT(*) FROM "Card" WHERE sessionId = s.id AND status = 'answered') as cards_answered,
  (SELECT atsScore FROM "ValidationResult" vr
   JOIN "Resume" r ON vr.resumeId = r.id
   WHERE r.sessionId = s.id) as ats_score
FROM "Session" s
JOIN "Profile" p ON s.profileId = p.id
WHERE s.userId = $1
ORDER BY s.createdAt DESC
LIMIT 20;
```

---

## Performance Tips

### Indexes (Already Configured)
- `idx_session_user_state` — Fast filtering by user + state
- `idx_session_created` — Sorted list of sessions
- `idx_card_session_status` — Find pending cards for a session
- `idx_jd_hash` — Cache hit lookup
- `idx_skill_match_session` — Get all matches for a session
- `idx_session_event_session` — Audit log lookup

### Avoid N+1 Queries
Always fetch related data in one query using JOINs or batch queries:
```sql
-- BAD: N+1 problem
SELECT * FROM "Session" WHERE userId = $1;
-- Then for each session...
SELECT * FROM "Card" WHERE sessionId = ?;

-- GOOD: Single query
SELECT s.*, COUNT(c.id) as card_count
FROM "Session" s
LEFT JOIN "Card" c ON s.id = c.sessionId AND c.status = 'pending'
WHERE s.userId = $1
GROUP BY s.id;
```

### Archive Old Sessions
Periodically archive or delete expired sessions to keep table sizes manageable:
```sql
-- Archive sessions older than 90 days
INSERT INTO "SessionArchive" SELECT * FROM "Session"
WHERE state IN ('CANCELLED', 'EXPIRED') AND createdAt < NOW() - INTERVAL '90 days';

DELETE FROM "Session"
WHERE state IN ('CANCELLED', 'EXPIRED') AND createdAt < NOW() - INTERVAL '90 days';
```

---

## Migration Strategy

### Adding a New Table
1. Edit `apps/api/prisma/schema.prisma` with the new model
2. Run `pnpm run prisma:generate` to update types
3. Run `pnpm run prisma:migrate` (creates migration file)
4. Run migration: `psql ... -f migration_file.sql`

### Adding a New Column
1. Edit the model in `schema.prisma`
2. Run `pnpm run prisma:generate`
3. Create migration: `pnpm run prisma:migrate`
4. Apply migration

### Dropping a Table / Column
⚠️ **Destructive:** Backup first!
```bash
# Backup production database before dropping
pg_dump -h 127.0.0.1 -p 5433 -U cotailor cotailor > backup_$(date +%s).sql

# Then create migration for the drop
pnpm run prisma:migrate
```

---

## Troubleshooting

### Can't Connect to Postgres
```bash
# Check if Postgres is running
psql -h 127.0.0.1 -p 5433 -U cotailor -d cotailor -c "SELECT 1"

# If not running:
/c/cotailor-pg/pgsql/bin/pg_ctl -D /c/cotailor-pg/data -o "-p 5433" -l /c/cotailor-pg/pg.log start

# Check log
tail -f /c/cotailor-pg/pg.log
```

### Schema Not Initialized
```bash
# Run init script
psql -h 127.0.0.1 -p 5433 -U cotailor -d cotailor -f apps/api/prisma/init.sql

# Verify
psql -h 127.0.0.1 -p 5433 -U cotailor -d cotailor -c "\dt"
```

### Prisma Client Out of Sync
```bash
# Regenerate types
pnpm run prisma:generate

# Rebuild shared package
pnpm --filter @cotailor/shared run build
```

### Query Returns No Results
- Check table name (case-sensitive with quotes)
- Check column names
- Verify WHERE clause logic
- Use `EXPLAIN` to debug slow queries

```sql
EXPLAIN ANALYZE
SELECT * FROM "Session" WHERE userId = $1;
```

---

**Last updated:** 2026-07-03  
**Author:** CoTailor Database Team
