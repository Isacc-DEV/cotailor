# CoTailor: Collaborative AI Resume Tailoring Agent
## Complete Architecture & Development Guide

> **The collaborative AI resume agent that checks job fit before it writes a word** — and never puts anything on your resume that isn't true.

**Last updated:** 2026-07-03  
**Status:** Foundations ready (Week 1–2 complete); Weeks 3–4 ahead

---

## Quick Start

```bash
# Install deps (if not done)
pnpm install
pnpm run prisma:generate

# Start dev (both apps run on localhost:3000 + 3001)
pnpm dev

# Type check all packages
pnpm run typecheck

# Build for production
pnpm run build
```

**Web:** http://localhost:3000  
**API:** http://localhost:3001  
**API health:** `curl http://localhost:3001/health`

---

## 1. Architecture Overview

### Monorepo Structure
```
cotailor/
├── apps/
│   ├── api/              NestJS 10 + Prisma 5 (backend)
│   └── web/              Next.js 15 (frontend)
├── packages/
│   └── shared/           TypeScript enums + Zod schemas
├── pnpm-workspace.yaml   Monorepo config
└── docker-compose.yml    Postgres + Redis (optional Docker setup)
```

### Key Dependencies
| Layer | Tech | Version |
|-------|------|---------|
| Frontend | Next.js, React, TypeScript | 15, 19, 5.7 |
| Backend | NestJS, Prisma, PostgreSQL | 10, 5, 16 |
| Shared | TypeScript, Zod | 5.7, 3.25 |
| LLM | Stub (dev) / Claude (prod) | Adapter pattern |

---

## 2. Shared Packages (`packages/shared`)

### Purpose
Single source of truth for enums, schemas, and state machine. **Never redefine these in app-specific code.**

### Files

#### `src/enums.ts` — Canonical Vocabulary
- **SESSION_STATES** (15 total): `CREATED → JD_SUBMITTED → ANALYZING → ... → FINAL_READY | CANCELLED | EXPIRED`
- **CARD_TYPES** (10 total): `category_low_confidence`, `missing_required_skill`, `subtype_mismatch`, etc.
- **CARD_SEVERITIES**: `info`, `warning`, `blocking`, `critical`
- **MATCH_TYPES**: `exact`, `equivalent`, `similar_stack`, `same_family`, `missing`, `blocked_sensitive`
- **RISK_LEVELS**: `none`, `low`, `medium`, `high`, `critical`
- **PROVENANCE**: `profile_verified`, `user_confirmed`, `omitted` (how each resume bullet was sourced)
- **SENIORITY_LADDER**: `intern` → `junior` → `mid` → `senior` → `lead` → `staff` → `principal` → `manager_plus`
- **SUBTYPE_RELATIONS**: `same`, `subsumes`, `overlaps`, `sibling`, `unrelated` (for soft gates)
- **RESUME_STYLES**: `ats_strong`, `recruiter_friendly`, `balanced`

#### `src/schemas.ts` — Zod Validation Schemas
Used by both API (request/response) and web (form validation). All schemas are exported and importable.

Key schemas:
- `ProfileSchema` — User's saved resume profile (category, skills, base resume, etc.)
- `JDAnalysisSchema` — Extracted structure from job description
- `SkillMatchSchema` — Result of matching JD skills to profile skills
- `CardSchema` — A single decision card instance
- `StrategySchema` — User-approved tailoring strategy
- `ResumeSchema` — Generated resume with per-bullet provenance

#### `src/state-machine.ts` — Deterministic Session Flow
Defines all valid state transitions. Backend enforces this; frontend shows UI conditionally.

Example:
```typescript
CREATED → JD_SUBMITTED → ANALYZING → WAITING_SKILL_DECISIONS → STRATEGY_REVIEW → GENERATING → VALIDATING → FINAL_READY
```

#### `src/gates.ts` — Gate Logic Definition (Readable Map)
Describes the 4 gates (category hard, subtype soft, seniority, knockout) in human-readable form.

### Build
```bash
pnpm --filter @cotailor/shared run build
```
Outputs to `packages/shared/dist/`. Both apps import from here.

---

## 3. Database Architecture (`apps/api/prisma`)

### Overview
PostgreSQL 16 + Prisma ORM. 17 tables organized by domain. Schema is single source of truth for data structure.

### Key Tables

#### User & Auth
- **User** — Email, name, workspace membership (future)

#### Profiles
- **Profile** — Saved resume profile with category, subtype, seniority, skills, certifications, base resume text, work authorization

#### Sessions (Core Unit of Work)
- **Session** — Active or completed tailoring session; pinned profile snapshot; JD analysis; session state; pending cards count
- **SessionEvent** — Immutable audit log of every action (state transition, decision, system event)

#### Analysis & Matching
- **JDAnalysis** — Extracted from JD: category, subtype, seniority, required/preferred skills, tools, responsibilities, certifications, knockout requirements, domain keywords
- **SkillMatch** — Result of matching JD skills to profile skills; includes match type (exact/similar/missing), risk level, action recommendation
- **Card** — Decision card instances tied to a session; type, severity, status, user response

#### Generation & Output
- **Strategy** — User-approved strategy: target title, emphasis/avoid, per-role plan, style, assumed defaults, predicted score
- **Resume** — Generated resume as structured JSON with per-bullet provenance (profile_verified, user_confirmed, omitted)
- **ValidationResult** — Two-stage validation: content check (no unsupported claims), recruiter readability check, final scores
- **ExportLog** — Audit trail of exports (DOCX, PDF, JSON) with timestamp and user agent

### Enums (in schema.prisma)
- `Seniority` — intern, junior, mid, senior, lead, staff, principal, manager_plus
- `SessionState` — All 15 states (CREATED, JD_SUBMITTED, etc.)
- `CardType`, `CardStatus`, `CardSeverity` — For decision cards
- `MatchType`, `RiskLevel` — For skill matching
- `Provenance` — Source of each resume bullet
- `ResumeStyle` — ats_strong, recruiter_friendly, balanced

### Files
- **schema.prisma** — Full data model (1,000+ lines; read this to understand structure)
- **init.sql** — SQL script to create all 17 tables + enums directly (used instead of migrations on this machine)
- **migrations/** — Migration history (if applicable; this project uses init.sql instead)

### Setup
```bash
# Generate Prisma client types (always first)
pnpm run prisma:generate

# Option 1: Run migrations (needs Postgres running)
pnpm run prisma:migrate

# Option 2: Initialize schema directly from SQL (used on this machine)
psql -h 127.0.0.1 -p 5433 -U cotailor -d cotailor -f apps/api/prisma/init.sql
```

---

## 4. Backend Architecture (`apps/api`)

### Stack
- **Framework:** NestJS 10 (TypeScript, dependency injection, modular)
- **ORM:** Prisma 5
- **Database:** PostgreSQL 16
- **LLM:** Pluggable provider interface (stub for dev, Claude for prod)
- **Async Jobs:** (Ready for BullMQ; not yet wired)

### Directory Structure
```
apps/api/src/
├── main.ts                    Entry point
├── app.module.ts              Root module (imports all)
├── health.controller.ts       /health endpoint
├── core/                      Business logic (gates, cards, state transitions)
│   ├── gates.service.ts       Category, subtype, seniority, knockout gates
│   ├── cards.service.ts       Decision card creation/resolution
│   ├── session-transition.service.ts    State machine enforcement
│   ├── session-state.service.ts         Query current state
│   ├── events.service.ts      Event logging
│   └── core.module.ts
├── analysis/                  JD analysis pipeline
│   ├── analysis.service.ts    JD extraction, caching by hash
│   └── analysis.module.ts
├── sessions/                  Session CRUD & state queries
│   ├── sessions.controller.ts /api/v1/sessions/* endpoints
│   ├── sessions.service.ts
│   └── sessions.module.ts
├── profiles/                  Profile CRUD
│   ├── profiles.controller.ts /api/v1/profiles/* endpoints
│   ├── profiles.service.ts
│   └── profiles.module.ts
├── llm/                       LLM provider abstraction
│   ├── llm-provider.interface.ts    Defines interface (extractJDAnalysis, matchSkills, etc.)
│   ├── stub.provider.ts       Stub implementation (instant, zero cost)
│   ├── claude.provider.ts     Claude implementation (future; skeleton ready)
│   └── llm.module.ts          Injects provider based on env var
└── prisma/                    Database service & connection
    ├── prisma.service.ts
    └── prisma.module.ts
```

### Core Modules

#### `core/` — Business Logic
Enforces all gates, manages session state transitions, raises decision cards.

**Key Services:**
- `GatesService` — Evaluates category, subtype, seniority, knockout gates
- `CardsService` — Raises pending cards, resolves auto-resolvable cards, tracks answers
- `SessionTransitionService` — Enforces state machine; throws if invalid transition attempted
- `SessionStateService` — Queries current session state and pending cards
- `EventsService` — Logs all changes to `SessionEvent` table for audit trail

#### `analysis/` — JD Extraction
Parses job descriptions and extracts structured data.

**AnalysisService:**
- `extractJDAnalysis(jd_text)` — Calls LLM provider; returns category, skills, requirements, etc.
- Caches results by content hash; same JD served from cache
- 15k character cap enforced

#### `sessions/` — Session Management
CRUD operations and state queries.

**SessionsController (REST endpoints):**
- `POST /api/v1/sessions` — Create session from profile
- `GET /api/v1/sessions/{id}` — Get session + pending cards
- `POST /api/v1/sessions/{id}/jd` — Submit JD text; triggers analysis
- `POST /api/v1/sessions/{id}/decisions` — Answer card(s)
- `GET /api/v1/sessions/{id}/strategy` — Get proposed strategy
- `POST /api/v1/sessions/{id}/approve-strategy` — Approve; trigger generation
- `GET /api/v1/sessions/{id}/resume` — Get generated resume + validation results

#### `profiles/` — Profile Management
CRUD for saved profiles.

**ProfilesController:**
- `GET /api/v1/profiles` — List user's profiles
- `POST /api/v1/profiles` — Create profile
- `GET /api/v1/profiles/{id}` — Get profile
- `PUT /api/v1/profiles/{id}` — Update profile
- `DELETE /api/v1/profiles/{id}` — Delete profile

#### `llm/` — LLM Provider Abstraction
Pluggable interface so production can swap providers easily.

**LLMProvider Interface:**
```typescript
interface ILLMProvider {
  extractJDAnalysis(jd: string): Promise<JDAnalysisSchema>;
  matchSkills(jdSkills: string[], profileSkills: string[]): Promise<SkillMatchSchema[]>;
  generateStrategy(cards: Card[], decisions: Decision[]): Promise<StrategySchema>;
  generateResume(strategy: StrategySchema, profile: Profile): Promise<ResumeSchema>;
  validateResume(resume: ResumeSchema, jd: JDAnalysis): Promise<ValidationResultSchema>;
}
```

**Available Implementations:**
- **StubProvider** (dev) — Returns mock data instantly; zero cost
- **ClaudeProvider** (prod) — Calls Anthropic API; ~$0.05–$0.20 per session

**Configuration:**
```env
LLM_PROVIDER=stub           # dev
LLM_PROVIDER=claude         # prod (requires ANTHROPIC_API_KEY)
```

### API Response Pattern
All endpoints return:
```typescript
{
  success: boolean;
  data?: T;                 // Endpoint-specific payload
  error?: { message: string; code: string };
  timestamp: ISO8601;
}
```

### Error Handling
- Invalid state transition → `409 Conflict` with `allowed_actions` array
- Invalid input → `400 Bad Request` with validation errors
- Not found → `404`
- Server error → `500`

### Running the Backend
```bash
# Dev mode (watch)
pnpm --filter @cotailor/api run dev

# Or from root (with web in parallel)
pnpm dev   # Starts both web + api
```

---

## 5. Frontend Architecture (`apps/web`)

### Stack
- **Framework:** Next.js 15 (App Router, TypeScript)
- **UI Library:** React 19
- **Styling:** (Your choice — CSS modules, Tailwind, styled-components, etc.)
- **State:** React Context / custom hooks (no Redux yet)

### Directory Structure (Recommended)
```
apps/web/src/
├── app/
│   ├── layout.tsx             Root layout
│   ├── page.tsx               Landing page
│   ├── profile-selector/
│   │   └── page.tsx           Select/create profile
│   ├── jd-input/
│   │   └── page.tsx           Paste JD text
│   ├── decision-board/
│   │   └── page.tsx           Answer cards
│   ├── strategy-review/
│   │   └── page.tsx           Review strategy
│   ├── resume-preview/
│   │   └── page.tsx           View resume + match report
│   └── api/                   (Not used; API calls go to localhost:3001)
├── components/
│   ├── card/
│   │   ├── DecisionCard.tsx   Reusable card component
│   │   └── CardTypes.tsx      Specific card implementations
│   ├── session/
│   │   ├── SessionProvider.tsx State context
│   │   └── useSession.ts      Custom hook
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── ...
│   └── layout/
│       ├── Header.tsx
│       └── Footer.tsx
├── lib/
│   ├── api-client.ts          Wrapper for localhost:3001 calls
│   ├── schemas.ts             Import from @cotailor/shared
│   └── utils.ts
├── hooks/
│   ├── useSession.ts
│   ├── useCards.ts
│   └── ...
├── styles/
│   └── globals.css
└── types/
    └── index.ts               Re-export from @cotailor/shared
```

### Core Screens (What to Build)

**1. Profile Selector** (`/profile-selector`)
- List saved profiles (category, subtype, seniority, skills)
- "Create Profile" button
- Select one to start session
- On select → `POST /api/v1/sessions` → redirect to JD Input

**2. JD Input** (`/jd-input`)
- Text input (max 15k chars) or file upload
- Submit button
- On submit → `POST /api/v1/sessions/{id}/jd` → state transitions to ANALYZING
- Show loading state while analyzing

**3. State Handlers (Conditional Rendering)**
- If state is `CATEGORY_REJECTED` → show "Mismatch" screen + "Select Another Profile" / "Use Another JD"
- If state is `WAITING_CATEGORY_CONFIRMATION` → show confirmation dialog for detected category
- If state is `WAITING_SUBTYPE_CONFIRMATION` → show soft gate card (approve/cancel)

**4. Decision Board** (`/decision-board`)
- Display all pending cards (max 7)
- Each card has type-specific options (radio buttons, checkboxes, dropdowns)
- "Assumed defaults" section for auto-resolved cards
- Submit all answers → `POST /api/v1/sessions/{id}/decisions` → state transitions to STRATEGY_REVIEW

**5. Strategy Review** (`/strategy-review`)
- Display proposed strategy (target title, emphasis/avoid, per-role plan, style, predicted score)
- "Approve" button → `POST /api/v1/sessions/{id}/approve-strategy` → state transitions to GENERATING
- "Adjust" button → reopens Decision Board
- Show loading while strategy is being generated

**6. Resume Preview** (`/resume-preview`)
- Display generated resume (formatted HTML or styled React component)
- Show match report: required/preferred skill coverage, ATS score, recruiter readability, warnings
- "Changes Made" view (highlight what was tailored)
- Export buttons: DOCX, PDF, JSON

### Session Context / State Management
Recommended approach:
```typescript
// hooks/useSession.ts
const useSession = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async (profileId: string) => { /* POST /sessions */ };
  const submitJD = async (sessionId: string, jdText: string) => { /* POST /sessions/{id}/jd */ };
  const answerCards = async (sessionId: string, decisions: Decision[]) => { /* POST /sessions/{id}/decisions */ };
  // ... etc

  return { session, loading, error, createSession, submitJD, answerCards, ... };
};
```

### API Client
Wrapper for calling localhost:3001:
```typescript
// lib/api-client.ts
export const api = {
  profiles: {
    list: () => fetch('http://localhost:3001/api/v1/profiles'),
    create: (data) => fetch(..., { method: 'POST', body: JSON.stringify(data) }),
    // ...
  },
  sessions: {
    create: (data) => fetch(...),
    get: (id) => fetch(...),
    submitJD: (id, jdText) => fetch(...),
    answerCards: (id, decisions) => fetch(...),
    // ...
  },
};
```

### Shared Types
Always import schemas from `@cotailor/shared`:
```typescript
import { SessionState, CardType, ProfileSchema, JDAnalysisSchema } from '@cotailor/shared';

const session: Session = { ... };
const cards: Card[] = [ ... ];
```

### Running the Frontend
```bash
# Dev mode (watch)
pnpm --filter @cotailor/web run dev

# Or from root
pnpm dev   # Starts both web + api
```

Open http://localhost:3000 in browser.

---

## 6. State Machine (Complete Reference)

### 15 Session States

| State | Meaning | Next States |
|-------|---------|-------------|
| `CREATED` | Profile selected, awaiting JD | JD_SUBMITTED, CANCELLED |
| `JD_SUBMITTED` | JD text received | ANALYZING, CANCELLED |
| `ANALYZING` | JD extraction job running | CATEGORY_REJECTED, WAITING_CATEGORY_CONFIRMATION, WAITING_SUBTYPE_CONFIRMATION, WAITING_SKILL_DECISIONS, CANCELLED |
| `CATEGORY_REJECTED` | Hard gate failed (category mismatch) | Terminal — no next state |
| `WAITING_CATEGORY_CONFIRMATION` | Low-confidence category; user confirms | CATEGORY_REJECTED, WAITING_SUBTYPE_CONFIRMATION, WAITING_SKILL_DECISIONS, CANCELLED |
| `WAITING_SUBTYPE_CONFIRMATION` | Soft gate: subtype mismatch | WAITING_SKILL_DECISIONS, CANCELLED |
| `WAITING_SKILL_DECISIONS` | Decision Board shown; user answers cards | STRATEGY_REVIEW (when all answered), CANCELLED |
| `STRATEGY_REVIEW` | User reviews proposed strategy | GENERATING, WAITING_SKILL_DECISIONS (reopen board), CANCELLED |
| `GENERATING` | Resume generation job running | VALIDATING, CANCELLED |
| `VALIDATING` | Two-stage validation running | FINAL_READY, NEEDS_REVISION, CANCELLED |
| `NEEDS_REVISION` | Validation failed; user can adjust | REVISING, CANCELLED |
| `REVISING` | User adjusting resumed | VALIDATING, CANCELLED |
| `FINAL_READY` | Resume validated and ready for export | Terminal |
| `CANCELLED` | User cancelled session | Terminal |
| `EXPIRED` | Session timeout (future) | Terminal |

### Terminal States
Once entered, no further transitions:
- `CATEGORY_REJECTED`
- `FINAL_READY`
- `CANCELLED`
- `EXPIRED`

### State Transition Enforcement
**Backend enforces via `SessionTransitionService`:**
```typescript
async transition(sessionId, targetState) {
  const current = await getSessionState(sessionId);
  const allowed = STATE_MACHINE[current];
  
  if (!allowed.includes(targetState)) {
    throw new ConflictException({
      message: `Cannot transition from ${current} to ${targetState}`,
      allowed_actions: allowed,
    });
  }
  
  // Execute transition...
}
```

**Frontend respects state; shows conditional UI:**
```typescript
if (session.state === 'CATEGORY_REJECTED') {
  return <CategoryRejectedScreen />;
} else if (session.state === 'WAITING_SKILL_DECISIONS') {
  return <DecisionBoard />;
} else if (session.state === 'FINAL_READY') {
  return <ResumePreview />;
}
```

---

## 7. Gates & Decision Cards

### The 4 Gates (Backend-Enforced)

#### 1. Category Hard Gate (No Override)
- **When:** After JD analysis completes
- **Rule:** Profile category must match JD category
- **Confidence bands:**
  - ≥ 0.95 confidence → Hard match or mismatch (act immediately)
  - 0.80–0.95 confidence → Soft match (ask user to confirm)
  - < 0.80 confidence → Raise `category_low_confidence` card
- **Outcome:**
  - Match → Continue to subtype gate
  - Mismatch (high confidence) → `CATEGORY_REJECTED` (terminal; user must select different profile or JD)
  - Low confidence → `WAITING_CATEGORY_CONFIRMATION` (user confirms or corrects)

#### 2. Subtype Soft Gate (Override Allowed)
- **When:** Category gate passes
- **Rule:** Profile subtype vs JD subtype relation
- **Examples:**
  - Profile: Backend, JD: Full Stack → relation = `subsumes` → soft warning
  - Profile: Frontend, JD: Backend → relation = `sibling` → soft warning
  - Profile: Backend, JD: Backend → relation = `same` → continue silently
- **Outcome:**
  - `same` → Continue
  - `subsumes` / `overlaps` / `sibling` → Raise `subtype_mismatch` card (user approves or cancels)
  - `unrelated` → May hard-reject or raise card (depends on rules)

#### 3. Seniority Check (Soft)
- **When:** Subtype gate passes
- **Rule:** JD seniority vs profile seniority
- **Examples:**
  - Profile: Senior, JD: Mid → OK (profile is overqualified)
  - Profile: Mid, JD: Senior → Raise `seniority_gap` card
  - Profile: Junior, JD: Principal → Raise critical `seniority_gap` card
- **Outcome:** Card is raised; user decides action (adjust resume to match JD level, or stay as-is)

#### 4. Knockout Requirements (Hard or Soft)
- **When:** Seniority check passes
- **Rule:** JD specifies non-negotiable requirements (work authorization, clearance, onsite location, min years, license/degree)
- **Check:** Are these satisfiable from profile?
- **Outcome:**
  - Auto-resolvable → Silent (e.g., profile says "US work auth" and JD requires it)
  - Unresolvable → Raise critical `knockout_requirement` card (user confirms or cancels)

### Decision Cards (10 Types)

| Card Type | Severity | Raised When | Options |
|-----------|----------|-------------|---------|
| `category_low_confidence` | warning | Category detected with <0.8 confidence | Confirm detected / Select other |
| `subtype_mismatch` | warning | Subtype mismatch (soft gate) | Approve anyway / Cancel |
| `seniority_gap` | warning | JD seniority > profile seniority | Adjust to JD level / Stay as-is / Cancel |
| `missing_required_skill` | blocking | JD required skill not in profile | Skills-only / Omit / Cancel |
| `similar_skill` | warning | JD required skill has similar in profile | Claim similar / Skills-only / Omit |
| `knockout_requirement` | critical | JD requires non-negotiable item | Confirm have it / Omit / Cancel |
| `certification_risk` | blocking | JD requires cert; profile lacks | Claim studying / Omit / Cancel |
| `resume_style` | info | Style choice offered | ats_strong / recruiter_friendly / balanced |
| `strategy_approval` | info | Strategy generated | (Approval handled in STRATEGY_REVIEW state) |
| (More as needed) | | | |

### Decision Board UX
- **Max 7 cards** (design Section 7.5; fatigue ceiling)
- **Auto-resolved cards** (low-stakes) are omitted from board; listed under "Assumed Defaults"
- **Answer order:** Any order; no sequence required
- **Safe defaults:** Preferred-skill gap auto-resolves to `omit`; preferred-similar-skill auto-resolves to `omit`
- **Submit:** All pending cards answered → state transitions to STRATEGY_REVIEW

---

## 8. Development Workflow

### Local Setup
```bash
# 1. Install Node 20+ and pnpm
node --version  # 20+
pnpm --version  # 11.9.0+

# 2. Clone / navigate to repo
cd "d:\Code\tailor resume"

# 3. Install workspace deps
pnpm install

# 4. Generate Prisma client
pnpm run prisma:generate

# 5. Verify Postgres is running
psql -h 127.0.0.1 -p 5433 -U cotailor -d cotailor -c "SELECT 1"

# 6. Initialize schema (one-time)
psql -h 127.0.0.1 -p 5433 -U cotailor -d cotailor -f apps/api/prisma/init.sql

# 7. Start dev servers
pnpm dev
```

### Scripts (Root)
| Script | Command | Does |
|--------|---------|------|
| Dev | `pnpm dev` | Build shared → run web + api in watch mode |
| Build | `pnpm run build` | Build shared → api → web (production) |
| Type check | `pnpm run typecheck` | TypeScript check all packages (no build) |
| Prisma generate | `pnpm run prisma:generate` | Generate @prisma/client types |
| Prisma migrate | `pnpm run prisma:migrate` | Run schema migrations (needs Postgres) |
| DB up | `pnpm run db:up` | Start Postgres + Redis (docker compose up -d) |
| DB down | `pnpm run db:down` | Stop Postgres + Redis (docker compose down) |

### Development Tips

#### Shared Packages
If you update `packages/shared`:
1. Make changes to enums / schemas
2. Run `pnpm --filter @cotailor/shared run build`
3. Both api + web automatically import the updated version

#### Backend Changes
1. Edit `apps/api/src/**/*.ts`
2. Backend automatically rebuilds (watch mode)
3. If Prisma schema changed: run `pnpm run prisma:generate` again

#### Frontend Changes
1. Edit `apps/web/src/**/*`
2. Frontend automatically rebuilds (watch mode)
3. Refresh browser to see changes

#### Database Schema Changes
1. Edit `apps/api/prisma/schema.prisma`
2. Run `pnpm run prisma:generate` (regenerate types)
3. If using migrations: `pnpm run prisma:migrate` (create migration + apply)
4. If using init.sql: manually update the SQL file + restart Postgres

#### Debugging API
```bash
# In new terminal, watch API logs
pnpm --filter @cotailor/api run dev

# Or use VS Code debugger with .vscode/launch.json config
```

#### Testing Endpoints
```bash
# Health check
curl http://localhost:3001/health

# List profiles (empty initially)
curl http://localhost:3001/api/v1/profiles

# Create profile
curl -X POST http://localhost:3001/api/v1/profiles \
  -H "content-type: application/json" \
  -d '{"name":"Backend Engineer","category":"Software Engineering","seniority":"senior","skills":["Node.js","PostgreSQL"]}'

# Create session
curl -X POST http://localhost:3001/api/v1/sessions \
  -H "content-type: application/json" \
  -d '{"profileId":"<profile-id>"}'

# Submit JD
curl -X POST http://localhost:3001/api/v1/sessions/<session-id>/jd \
  -H "content-type: application/json" \
  -d '{"jdText":"... job description text ..."}'
```

---

## 9. Code Quality & Standards

### TypeScript
- **Strict mode:** Always on
- **Imports:** Use absolute paths (configured in `tsconfig.base.json`)
- **Types:** Prefer interfaces for contracts; use `type` for unions/tuples

### Naming Conventions
- **Files:** kebab-case (e.g., `session-transition.service.ts`)
- **Classes:** PascalCase (e.g., `SessionTransitionService`)
- **Functions:** camelCase (e.g., `submitJD()`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `CARD_BUDGET = 7`)
- **Enums:** PascalCase (e.g., `SessionState`, `CardType`)

### Folder Organization
- Services in `src/*/service.ts`
- Controllers in `src/*/controller.ts`
- Modules in `src/*/module.ts`
- One responsibility per file

### Comments
- Avoid obvious comments ("get session", "return true")
- Explain WHY, not WHAT
- Reference design doc sections when needed (e.g., "Section 8 — category gate logic")

### Error Messages
- Be specific: "Cannot transition from JD_SUBMITTED to FINAL_READY (allowed: ANALYZING, CANCELLED)"
- Include `code` and `message` fields in response
- Never expose stack traces in API responses (log server-side)

---

## 10. Roadmap

### MVP 1 (Weeks 1–4) — ✅ Foundations Done; 🔄 Weeks 3–4 In Progress
- [x] Monorepo scaffold
- [x] Prisma schema (17 tables)
- [x] Shared enums + schemas + state machine
- [x] Backend state machine + gates + session CRUD
- [x] Stub LLM provider (zero-cost dev)
- [x] Profile CRUD + session management
- [ ] Frontend: Profile Selector, JD Input, Decision Board, Strategy Review, Resume Preview (to build)
- [ ] End-to-end flow: select profile → submit JD → answer cards → approve strategy → export

### MVP 2 (Weeks 5–10) — Future
- [ ] Decision memory (confirmed skills not asked again)
- [ ] LLM provider integration (Claude, OpenAI fallback)
- [ ] Chat-mode resume edit (after generation)
- [ ] Premium team workspace (invite members, shared profile library)
- [ ] LinkedIn optimizer
- [ ] Cover letter generator
- [ ] Interview risk report
- [ ] Application tracker

### MVP 3+ (Later)
- [ ] Mobile app
- [ ] Slack integration
- [ ] API for career coaches / agencies
- [ ] Resume version history + rollback
- [ ] Analytics dashboard

---

## 11. FAQ & Common Issues

### Q: I'm getting "SIGILL in Prisma engine"
**A:** This machine runs Postgres in driver-adapter mode (pure-JS `pg` driver, no native engine). It's already configured in `apps/api/src/prisma/prisma.service.ts`. No action needed.

### Q: How do I regenerate the Prisma client?
**A:** Run `pnpm run prisma:generate`. Always do this after editing `schema.prisma`.

### Q: How do I see database logs?
**A:** Check the PostgreSQL log at `/c/cotailor-pg/pg.log` (on this machine).

### Q: Can I use Docker instead of portable Postgres?
**A:** Yes, on a normal machine: run `pnpm run db:up` (docker compose up -d) to start Postgres on port 5432. Adjust `DATABASE_URL` in `.env`.

### Q: What's the LLM cost per session?
**A:** Stub (dev): $0. Claude (prod): ~$0.05–$0.20 per session (depends on JD size and resume length).

### Q: Can I skip the Decision Board and generate directly?
**A:** No; by design. Gates + cards enforce the "check job fit before writing" principle. Users always see critical gates and have a chance to confirm.

### Q: How do I know if a screen is "done"?
**A:** Test the full flow: navigate → call backend → get response → display data. Error handling must work. Loading states must show.

---

## 12. Useful Resources

### Inside This Project
- **Design Doc:** `AI-Resume-Tailor-System-Design.md` (comprehensive; read Sections 1–13 for core logic)
- **README:** `README.md` (quick setup reference)
- **Prep Guide:** `https://claude.ai/code/artifact/...` (architecture overview)

### External Docs
- **NestJS:** https://docs.nestjs.com
- **Prisma:** https://www.prisma.io/docs
- **Next.js:** https://nextjs.org/docs
- **Zod:** https://zod.dev
- **React 19:** https://react.dev

### Team Communication
- Decisions logged in git commits
- Architecture questions → refer to design doc + code comments
- Blockers → ping team in Slack with error message + screenshots

---

## 13. Contact & Support

For questions:
1. **Architecture / Design:** Refer to `AI-Resume-Tailor-System-Design.md` (Sections 1–13)
2. **Code Structure:** Check this file (CLAUDE.md) + inline code comments
3. **API Contract:** Review `apps/api/src/*/controller.ts` + shared schemas
4. **Frontend Patterns:** Look at existing components in `apps/web/src/`
5. **Database:** Query `apps/api/prisma/schema.prisma` directly

---

**Last updated:** 2026-07-03  
**Author:** Collaborative AI Resume Team  
**License:** (Specify your license — e.g., MIT, proprietary)
