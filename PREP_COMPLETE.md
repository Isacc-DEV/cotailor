# ✅ CoTailor Pre-Work Preparation Complete

> All architectural documentation, database specifications, and frontend UI flow guides are now prepared and ready for development.

**Date:** 2026-07-03  
**Status:** ✅ Ready to Start Coding

---

## What's Been Prepared

### 📋 Documentation Files Created

| File | Purpose | Read Time |
|------|---------|-----------|
| **CLAUDE.md** | Complete architecture guide (backend, frontend, database, state machine, dev workflow) | 30–45 min |
| **FRONTEND_SCREENS.md** | Detailed screen-by-screen UI specifications (11 screens, component breakdown, API calls) | 45–60 min |
| **DATABASE_GUIDE.md** | Full database reference (17 tables, enums, common queries, troubleshooting) | 30–40 min |
| **PREP_COMPLETE.md** (this file) | Summary of preparation + next steps | 5 min |

### 🎯 What's Documented

#### Backend Architecture
- ✅ NestJS module structure (core, analysis, sessions, profiles, llm, prisma)
- ✅ Service responsibilities and API endpoints
- ✅ LLM provider abstraction (stub for dev, Claude for prod)
- ✅ Error handling patterns
- ✅ Development scripts and workflow

#### Frontend Architecture
- ✅ 11 core screens (Profile Selector, JD Input, Decision Board, Strategy Review, Resume Preview, etc.)
- ✅ State-based conditional rendering
- ✅ API client wrapper for localhost:3001
- ✅ Component structure and reusable UI components
- ✅ Session state management (Context + hooks pattern)
- ✅ Build order and testing checklist

#### Database Architecture
- ✅ 17 tables with full schema definitions
- ✅ 8 enums (SessionState, CardType, Seniority, etc.)
- ✅ Key relationships and constraints
- ✅ Common queries for each table
- ✅ Performance tips and indexes
- ✅ Migration strategy

#### Business Logic
- ✅ 15 session states and valid transitions
- ✅ 4 gates (category hard, subtype soft, seniority, knockout)
- ✅ 10 decision card types with options
- ✅ Skill matching logic
- ✅ Resume generation flow
- ✅ Validation rules

---

## File Locations

All documentation is in the project root:

```
d:\Code\tailor resume\
├── CLAUDE.md ........................ Main architecture guide
├── FRONTEND_SCREENS.md .............. UI/UX specifications
├── DATABASE_GUIDE.md ................ Database reference
├── PREP_COMPLETE.md ................. This summary
├── AI-Resume-Tailor-System-Design.md  Product/design doc (existing)
└── README.md ........................ Quick start (existing)
```

---

## Next Steps (Start Here)

### Step 1: Team Alignment Meeting (1 hour)
Gather the team and review:

**Part 1: Understand the Vision** (15 min)
- Read *AI-Resume-Tailor-System-Design.md* Sections 1–6 (product story, differentiator, business flow)
- Discuss: What makes CoTailor different? (Honest tailoring, fit gates before generation, decision cards)

**Part 2: Understand the Architecture** (20 min)
- Walk through CLAUDE.md Section 1–3 (architecture overview, shared packages, database)
- Discuss: Monorepo structure, how shared vocabulary works, database design

**Part 3: Assign Ownership** (25 min)
- Review FRONTEND_SCREENS.md (11 screens)
- Decide: Who owns Profile Selector? JD Input? Decision Board? Etc.
- Clarify: API contract for each screen (which endpoints, request/response shapes)

### Step 2: Environment Setup (15 min)
Follow CLAUDE.md Section 8 (Development Workflow):
```bash
cd "d:\Code\tailor resume"
pnpm install
pnpm run prisma:generate
pnpm run typecheck
pnpm dev
```

Verify:
- [ ] `pnpm dev` starts both web (localhost:3000) and api (localhost:3001)
- [ ] `curl http://localhost:3001/health` returns `{"status":"ok"}`
- [ ] No TypeScript errors
- [ ] PostgreSQL is running (psql works)

### Step 3: Individual Code Exploration (2 hours, async)
Each team member explores their assigned area:

**Backend Developers:**
1. Read CLAUDE.md Sections 4, 6, 7 (backend architecture, state machine, gates)
2. Explore `apps/api/src/core/` (gates, cards, session transitions)
3. Explore `apps/api/prisma/schema.prisma` (data model)
4. Play with curl commands in CLAUDE.md Section 8 (test API endpoints)

**Frontend Developers:**
1. Read FRONTEND_SCREENS.md (all 11 screens)
2. Read CLAUDE.md Sections 5 (frontend architecture)
3. Explore `apps/web/` structure
4. Create initial component structure (folders for each screen)

**Full-Stack / Architecture:**
1. Read CLAUDE.md (all sections)
2. Read DATABASE_GUIDE.md (schema deep dive)
3. Understand state machine flow (CLAUDE.md Section 6 + FRONTEND_SCREENS.md conditional rendering)

### Step 4: Set Up Development Workflow (30 min)
Agree on:
- [ ] Git workflow (feature branches, commit message style)
- [ ] Code review process (who reviews, checklist)
- [ ] Deployment pipeline (dev → staging → prod)
- [ ] How to handle shared package updates (both apps use `@cotailor/shared`)
- [ ] Async communication (Slack channels for different concerns)

### Step 5: Start Coding (Follow Build Order)

**Week 1: Backend + Shared Foundations**
- [ ] Verify all enums and schemas in `packages/shared` are correct
- [ ] Test backend state machine (all transitions)
- [ ] Test gates service (category, subtype, seniority, knockout logic)
- [ ] Test API endpoints (profiles, sessions, JD submission)

**Week 2–3: Frontend Foundations**
1. **Reusable UI Components** (Button, Input, Modal, Badge, Spinner, etc.)
2. **Screen 1: Landing Page** (hero + CTAs)
3. **Screen 2: Profile Selector** (list profiles, select one, create session)
4. **Screen 3: JD Input** (text input, validation, submit)
5. **Screen 6: Decision Board** (display cards, answer, submit)
6. **Screen 7: Strategy Review** (display strategy, approve)
7. **Screen 10: Resume Preview** (display resume + match report)

**Week 3–4: Integration + Polish**
- [ ] Connect all screens to backend API
- [ ] Test state machine flow end-to-end
- [ ] Error handling (network, validation, server errors)
- [ ] Loading states (spinners, progress bars)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessibility (keyboard nav, ARIA labels)

---

## Key Decisions Already Made (Don't Re-litigate)

These are documented in the design doc and should be respected:

| Decision | Rationale | Details |
|----------|-----------|---------|
| **No "generate anyway" button** | Enforce honest tailoring | Category hard gate is terminal if mismatch |
| **Max 7 decision cards** | Avoid decision fatigue | Low-stakes cards auto-resolve with safe defaults |
| **Decision Board is central** | Collaborative structure | No freeform chat; all questions are structured cards |
| **One profile snapshot per session** | Prevent mid-session profile edits breaking session | Profile is immutable during session |
| **Every resume bullet has provenance** | Honesty guarantee | profile_verified, user_confirmed, or omitted |
| **Backend-owned state machine** | Enforce rules | Frontend never makes state transitions; backend enforces |
| **LLM provider abstraction** | Flexibility | Swap Claude ↔ OpenAI without code changes |
| **Stub LLM for dev** | Zero-cost iteration | No API calls until ready for prod |

---

## Quick Reference: Key Files

### To Understand:
- **Product Vision:** Read *AI-Resume-Tailor-System-Design.md* Sections 1–6
- **Core Logic:** Read *AI-Resume-Tailor-System-Design.md* Sections 7–13
- **API Contract:** Read CLAUDE.md Section 4 + FRONTEND_SCREENS.md per screen
- **Database:** Read DATABASE_GUIDE.md Tables section + run `\d table_name` in psql

### To Code:
- **Backend patterns:** CLAUDE.md Section 4 (modules, services, controllers)
- **Frontend patterns:** FRONTEND_SCREENS.md per screen + CLAUDE.md Section 5
- **DB queries:** DATABASE_GUIDE.md common queries section
- **Dev workflow:** CLAUDE.md Section 8

### To Test:
- **API endpoints:** CLAUDE.md Section 8 (curl commands)
- **Database:** DATABASE_GUIDE.md common queries
- **Frontend:** FRONTEND_SCREENS.md testing checklist

---

## Communication & Issues

### If You Get Stuck:
1. **Architecture question?** → Refer to CLAUDE.md + *AI-Resume-Tailor-System-Design.md*
2. **API contract question?** → Refer to FRONTEND_SCREENS.md + CLAUDE.md Section 4
3. **Database question?** → Refer to DATABASE_GUIDE.md
4. **State machine question?** → Refer to CLAUDE.md Section 6 + code in `apps/api/src/core/`
5. **Code question?** → Read inline comments + look at similar code in the same file

### Who to Ask:
- **Backend architecture:** Backend lead (refer to CLAUDE.md Section 4)
- **Frontend architecture:** Frontend lead (refer to FRONTEND_SCREENS.md)
- **Database design:** Database lead (refer to DATABASE_GUIDE.md)
- **Product decisions:** Refer to *AI-Resume-Tailor-System-Design.md*

---

## Deliverables for This Week

### By EOD Today:
- [ ] Team has read and discussed CLAUDE.md Sections 1–3
- [ ] Team understands why decisions were made (honest tailoring, gates, cards)
- [ ] Role assignments finalized (who builds what)

### By EOW (Friday):
- [ ] Environment setup complete (pnpm dev runs, both apps start, DB is initialized)
- [ ] Backend team has verified all endpoints work (curl tests pass)
- [ ] Frontend team has sketched initial component structure
- [ ] Team has sync'd on git workflow and code review process

### Week 2:
- [ ] Backend tests pass (all services, gates, state transitions)
- [ ] Frontend foundation complete (UI components + layout)
- [ ] First screens drafted (Profile Selector, JD Input)

---

## Success Criteria

You'll know prep was successful when:

✅ All team members can:
- [ ] Explain the core differentiator (honest tailoring + gates + decision cards)
- [ ] Draw the state machine from memory (15 states, main transitions)
- [ ] Describe the 4 gates (category hard, subtype soft, seniority, knockout)
- [ ] List the 11 core screens and their purpose
- [ ] Run `pnpm dev` and see both apps start
- [ ] Call an API endpoint (curl or Postman)

✅ Backend team can:
- [ ] Explain how the state machine is enforced (SessionTransitionService)
- [ ] Describe the gate logic (GatesService)
- [ ] Walk through a session from creation to resume generation
- [ ] Write a query against the database

✅ Frontend team can:
- [ ] Describe the 11 screens and their flow
- [ ] Explain how state drives conditional rendering
- [ ] Set up a React Context for session state
- [ ] Create a reusable card component
- [ ] Call a backend endpoint from React

---

## Resources

### Inside This Repo
- `CLAUDE.md` — Authoritative architecture guide
- `FRONTEND_SCREENS.md` — UI specifications
- `DATABASE_GUIDE.md` — Database reference
- `AI-Resume-Tailor-System-Design.md` — Product design (Sections 1–13 for core logic)
- `README.md` — Quick start commands

### External References
- NestJS docs: https://docs.nestjs.com
- Prisma docs: https://www.prisma.io/docs
- Next.js docs: https://nextjs.org/docs
- React docs: https://react.dev

### Your Team
- Backend lead: Reference CLAUDE.md Section 4 + design doc Sections 14–19
- Frontend lead: Reference FRONTEND_SCREENS.md + CLAUDE.md Section 5
- Database lead: Reference DATABASE_GUIDE.md + design doc Section 17
- Product lead: Reference design doc + CLAUDE.md product vision

---

## Final Checklist: Ready to Code?

- [ ] CLAUDE.md is read and understood by the team
- [ ] FRONTEND_SCREENS.md is read by frontend team
- [ ] DATABASE_GUIDE.md is read by database team
- [ ] All team members can run `pnpm dev` successfully
- [ ] All team members can call `curl http://localhost:3001/health`
- [ ] Role assignments are clear (who builds which screens/services)
- [ ] API contracts are agreed upon (which endpoints, request/response shapes)
- [ ] Git workflow is documented
- [ ] Slack channels are set up (backend, frontend, architecture, general)
- [ ] First sprint / week 1 tasks are assigned
- [ ] Team understands state machine (15 states, transitions)
- [ ] Team understands gates (category, subtype, seniority, knockout)
- [ ] Team understands decision cards (10 types, user choices)

---

**If all checkboxes above are checked, you're ready to start coding! 🚀**

---

## Questions Before You Go

**Q: Where do I start if I'm a backend developer?**  
A: Read CLAUDE.md Section 4 (NestJS module structure) + DATABASE_GUIDE.md. Run `pnpm dev` and test endpoints with curl commands from CLAUDE.md Section 8.

**Q: Where do I start if I'm a frontend developer?**  
A: Read FRONTEND_SCREENS.md (11 screens) + CLAUDE.md Section 5. Start building the UI component library and Profile Selector screen.

**Q: What if I don't understand the state machine?**  
A: Read CLAUDE.md Section 6 (full state reference) and draw it out on paper. The code in `apps/api/src/core/session-transition.service.ts` shows exactly how it works.

**Q: How do I know which API endpoint to call?**  
A: Each screen in FRONTEND_SCREENS.md lists its API calls. Backend team: implement those endpoints as shown in CLAUDE.md Section 4.

**Q: What if a screen design is unclear?**  
A: FRONTEND_SCREENS.md describes each screen element-by-element. If it's still unclear, discuss in team sync or check the design doc (Sections 14–19).

**Q: How do I run the database locally?**  
A: PostgreSQL is already running at 127.0.0.1:5433 with schema initialized. See DATABASE_GUIDE.md "Quick Start" to connect.

**Q: Can I modify the state machine?**  
A: No — it's a core business rule. If you need a new state, discuss in team sync and update it together. Don't modify alone.

**Q: Can I skip creating the Decision Board and generate directly?**  
A: No — the Decision Board is core to the product (honest tailoring, user control). Every session must go through it.

**Q: What if the backend isn't ready yet?**  
A: Use stub responses in the frontend (see FRONTEND_SCREENS.md "API Mocking"). Frontend can build independently; integrate later.

---

## Closing Notes

CoTailor is a complex system, but the architecture has been carefully designed to separate concerns:

- **Backend:** Owns state machine, gates, business logic. Frontend never makes decisions.
- **Frontend:** Owns UI, user experience. All decisions are API calls to the backend.
- **Shared:** Enums, schemas, state-machine map. Single source of truth.
- **Database:** Single schema for all apps. Prisma as ORM.

This separation means:
- Frontend and backend can develop in parallel
- Both apps always use the same vocabulary (enums from shared)
- Business rules live in one place (backend)
- UI can evolve without breaking logic

**You have everything you need. Go build! 🎯**

---

**Prepared by:** Claude Code AI  
**Date:** 2026-07-03  
**Project:** CoTailor (Collaborative AI Resume Tailoring Agent)  
**Status:** ✅ Ready for Development
