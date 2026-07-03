# CoTailor Frontend: Screen-by-Screen Breakdown

> **Complete UI flow specification** for building the Next.js 15 frontend. Each screen lists its purpose, states, API calls, and components.

---

## Navigation Map

```
Landing Page (/)
├── Get Started
└── State Machine Demo (for dev/testing)

Profile Selector (/profile-selector)
├── List saved profiles
└── Select one → Create session

JD Input (/jd-input)
├── Paste text or upload file
└── Submit → Analyze

State Gates (Conditional Rendering)
├── CATEGORY_REJECTED → Category Mismatch Screen
├── WAITING_CATEGORY_CONFIRMATION → Category Confirmation Dialog
└── WAITING_SUBTYPE_CONFIRMATION → Subtype Mismatch Card

Decision Board (/decision-board)
├── Display all pending cards (max 7)
└── Submit answers → Generate strategy

Strategy Review (/strategy-review)
├── Review proposed strategy
└── Approve → Generate resume

Resume Preview (/resume-preview)
├── View generated resume
├── View match report
└── Export (DOCX, PDF, JSON)

(Future: Chat Edit, Session History)
```

---

## Screen 1: Landing Page (`/`)

### Purpose
Welcome screen. Show value proposition, guide users to start a session, link to existing sessions.

### Elements
- **Hero Section**
  - Headline: "Tailor Your Resume Honestly"
  - Subheading: "Check job fit before generation. Never fabricate a skill."
  - CTA Button: "Get Started" → `/profile-selector`

- **Feature Highlights** (3 columns)
  - "Fit Gates" — Category, subtype, seniority checks before generation
  - "Decision Board" — Collaborative, structured questions
  - "Provenance-Backed" — Every bullet traceable; no fabrication

- **How It Works** (Timeline / Steps)
  1. Select profile
  2. Paste job description
  3. Answer decision cards
  4. Approve strategy
  5. Export resume

- **Call-to-Action Buttons**
  - "Start Tailoring" → `/profile-selector`
  - "View Demo" → Demo session (state machine walkthrough)
  - "View Existing Sessions" → `/sessions` (list user's sessions; future feature)

### Responsive
- Desktop: Full width hero, 3-column grid below
- Mobile: Stacked sections, full-width buttons

### State
- Loading: Show spinner while fetching profile list
- Error: Show error message if profile list fails

---

## Screen 2: Profile Selector (`/profile-selector`)

### Purpose
User selects a saved profile (or creates new) to start a session. This is the entry point for a tailoring flow.

### Flow
1. Fetch list of user's profiles → `GET /api/v1/profiles`
2. Display profiles as cards/list
3. User selects one → Click → `POST /api/v1/sessions` with `profileId`
4. On success → Redirect to JD Input screen with `sessionId`

### Elements

#### Profiles List
- **Empty State**
  - Heading: "No profiles yet"
  - Text: "Create your first resume profile to get started"
  - Button: "Create Profile" → `/profile-create` (or modal)

- **Profile Cards** (if profiles exist)
  - Card per profile showing:
    - Profile name (e.g., "Backend Engineer — Node.js")
    - Category + Subtype + Seniority (badges)
    - Skills preview (first 5, `+ X more` if more exist)
    - "Select & Start Session" button
  - On click → Trigger session creation

- **Floating Action Button (FAB)**
  - "+ New Profile" button
  - Opens profile creation modal or navigates to `/profile-create`

#### States During Selection
- **Loading:** Show spinner on selected card while creating session
- **Error:** Toast/alert if session creation fails
  - Error message: "Failed to create session. Please try again."
  - Retry button

### API Calls
```
GET /api/v1/profiles
  Response: { success: true, data: Profile[] }

POST /api/v1/sessions
  Body: { profileId: string }
  Response: { success: true, data: { id: string, state: "CREATED", ... } }
```

### Components
- `ProfileList.tsx` — List/grid of profiles
- `ProfileCard.tsx` — Individual profile card
- `CreateProfileButton.tsx` or `CreateProfileModal.tsx`
- `useProfiles.ts` — Hook to fetch/manage profiles
- `useSession.ts` — Hook to create session

### Responsive
- Desktop: 2–3 column grid
- Tablet: 2 column grid
- Mobile: 1 column stack

---

## Screen 3: JD Input (`/jd-input`)

### Purpose
User pastes job description text or uploads a file. Validates input and submits to backend for analysis.

### Flow
1. User types/pastes JD text or uploads file
2. Real-time character count validation (max 15k)
3. Click "Analyze" → `POST /api/v1/sessions/{id}/jd`
4. Show loading state while analyzing
5. On success → State transitions, UI updates conditionally

### Elements

#### Input Area
- **Text Paste (Primary)**
  - Large textarea with placeholder text
  - Character count: "XXX / 15,000"
  - Real-time validation: Warn if approaching limit
  - Clear button (X icon)

- **File Upload (Secondary)**
  - Drag-and-drop zone or file picker
  - Accepts: .txt, .pdf, .docx (optional; PM decides)
  - On upload → Extract text, show in textarea, count chars

- **Submit Button**
  - Text: "Analyze Job Description"
  - Disabled if: Empty input or > 15k chars
  - On click → Send JD, show loading

- **Helpful Hints** (Optional)
  - "Paste the full job description including responsibilities, requirements, and nice-to-haves"
  - Link to example JD (optional)

### API Calls
```
POST /api/v1/sessions/{id}/jd
  Body: { jdText: string }
  Response: {
    success: true,
    data: {
      id: string,
      state: "ANALYZING" | "CATEGORY_REJECTED" | "WAITING_CATEGORY_CONFIRMATION" | ...
      pendingCards?: Card[]
    }
  }
```

### Error Handling
- **Validation errors:**
  - Text too long → Show red error, disable submit
  - Empty text → Disable submit button (not an error, just disabled state)

- **Server errors:**
  - Analysis failed → Toast: "Analysis failed. Please try again."
  - Show retry button

### Components
- `JDInput.tsx` — Main component
- `TextareaWithCounter.tsx` — Textarea + char count
- `FileUploadZone.tsx` — Drag-and-drop file upload
- `useJDInput.ts` — Hook for input validation

### State Transitions
After submitting JD, backend analyzes and returns a state. Frontend MUST handle:
- `ANALYZING` → Show loading spinner, then poll for state update or wait for websocket
- `CATEGORY_REJECTED` → Redirect to Category Rejected screen
- `WAITING_CATEGORY_CONFIRMATION` → Show category confirmation dialog
- `WAITING_SUBTYPE_CONFIRMATION` → Show subtype card (part of Decision Board or separate)
- `WAITING_SKILL_DECISIONS` → Redirect to Decision Board

---

## Screen 4: Category Gate Result (Conditional)

### When Shown
State is `CATEGORY_REJECTED` (hard gate failed).

### Purpose
Tell user why their profile doesn't match the JD category, and offer next actions.

### Elements

#### Rejection Message
- **Icon:** ❌ (red)
- **Title:** "This role doesn't match your profile"
- **Details:**
  - "Profile category: **Backend Engineer**"
  - "JD detected category: **Civil Engineering**"
  - "Confidence: 92%"
- **Explanation:** "We don't recommend tailoring for roles outside your selected profession. This helps prevent applying to misaligned positions."

#### Actions
- **Button 1:** "Select Another Profile" → Redirect to `/profile-selector`
- **Button 2:** "Use Another JD" → Redirect to `/jd-input` (with option to clear JD and try again)
- **Button 3:** "Cancel" → Redirect to landing or close session

### Components
- `CategoryRejectedScreen.tsx` — Full screen

### Notes
- This is a terminal state; session cannot proceed
- No "generate anyway" option (by design — enforces honest tailoring)

---

## Screen 5: Category Confirmation Dialog (Conditional)

### When Shown
State is `WAITING_CATEGORY_CONFIRMATION` (low-confidence category detection).

### Purpose
Confirm the detected category is correct before proceeding.

### Elements

#### Modal / Dialog
- **Title:** "Confirm Your Role Category"
- **Question:** "We detected the role as **Software Engineer**. Is this correct?"
- **Dropdown:** [Select category] (pre-filled with detected category)
  - Options: All 15+ job categories from `CATEGORY_RELATIONS`
  - E.g., "Software Engineering", "Data Science", "Product Management", "Design", etc.

#### Actions
- **Button 1:** "Yes, Continue" → Submit confirmed category, transition to next state
- **Button 2:** "No, Cancel" → Cancel session or go back to JD Input

### API Calls
```
POST /api/v1/sessions/{id}/decisions
  Body: {
    cards: [
      {
        id: string,
        type: "category_low_confidence",
        response: "confirmed"  // or "corrected"
        selectedCategory?: string  // if corrected
      }
    ]
  }
  Response: { success: true, data: { state: next state, pendingCards?: Card[] } }
```

### Components
- `CategoryConfirmationDialog.tsx` — Modal component
- Should be part of session flow logic, shown conditionally

---

## Screen 6: Decision Board (`/decision-board`)

### Purpose
Present all pending decision cards (max 7) for user to answer. This is the collaborative heart of CoTailor.

### Flow
1. Fetch session with pending cards → `GET /api/v1/sessions/{id}`
2. Display all cards
3. User answers each card (any order)
4. When all answered → Enable "Review Strategy" button
5. Click button → `POST /api/v1/sessions/{id}/decisions` with all answers
6. On success → Redirect to Strategy Review

### Elements

#### Header
- **Session Title:** "Decision Board"
- **Subtitle:** "Answer the questions below to tailor your resume"
- **Progress Indicator:** "X of Y cards answered" (optional visual)

#### Cards Container
- **Assumed Defaults Section** (if any)
  - Heading: "Assumed Defaults (not requiring your input)"
  - List of auto-resolved cards with explanation
  - E.g., "Preferred skill gap → Will omit from resume"

- **Pending Cards** (max 7)
  - Each card displays:
    - **Type label** (e.g., "Missing Required Skill")
    - **Severity badge** (info / warning / blocking / critical)
    - **Question text** (rendered from card data)
    - **Options** (radio buttons, checkboxes, or dropdowns depending on card type)
    - **Help text** (explanation of consequence of each option)

#### Card Type Examples

**1. Missing Required Skill**
```
Type: missing_required_skill
Severity: blocking
Question: "The job requires Kubernetes, but it's not in your profile. How would you like to handle this?"

Options:
○ Skills Only — List Kubernetes in Skills section (but not in experience bullets)
○ Omit — Don't mention Kubernetes at all
● Cancel — I don't want to apply to this role
```

**2. Subtype Mismatch**
```
Type: subtype_mismatch
Severity: warning
Question: "The job is Full Stack, but your profile is Backend. Full Stack roles often include frontend work. Continue?"

Options:
○ Yes, Generate Anyway
● No, Cancel
```

**3. Seniority Gap**
```
Type: seniority_gap
Severity: warning
Question: "The job requires Senior level. Your profile is Mid level. How would you like to present your experience?"

Options:
○ Adjust to Senior level (stretch experience)
● Stay as Mid level (be conservative)
○ Cancel
```

**4. Knockout Requirement**
```
Type: knockout_requirement
Severity: critical
Question: "The job requires US work authorization. Does your profile have this?"

Options:
● Yes, I have this
○ No, I don't have this
○ Cancel
```

**5. Certification Risk**
```
Type: certification_risk
Severity: blocking
Question: "The job requires AWS Certified Solutions Architect. Your profile doesn't have this. How would you like to handle it?"

Options:
○ I'm studying for this certification
○ Omit this requirement
● Cancel
```

**6. Resume Style** (Optional)
```
Type: resume_style
Severity: info
Question: "What resume style would you prefer?"

Options:
● Balanced (standard format)
○ ATS-Strong (optimized for screening software)
○ Recruiter-Friendly (human-readable with visual emphasis)
```

#### Submit Section
- **Button:** "Review Strategy"
- **Disabled until:** All pending cards are answered
- **On click:** Send all answers via POST, show loading, redirect on success

### API Calls
```
GET /api/v1/sessions/{id}
  Response: {
    success: true,
    data: {
      id: string,
      state: "WAITING_SKILL_DECISIONS",
      pendingCards: Card[],
      assumedDefaults?: { cardId: string, action: string, reason: string }[]
    }
  }

POST /api/v1/sessions/{id}/decisions
  Body: {
    cards: [
      {
        id: string,
        type: CardType,
        response: string | string[]  // depends on card type
      }
    ]
  }
  Response: {
    success: true,
    data: {
      id: string,
      state: "STRATEGY_REVIEW",  // or still "WAITING_SKILL_DECISIONS" if strategy isn't ready
      strategyReady?: boolean
    }
  }
```

### Components
- `DecisionBoard.tsx` — Main container
- `DecisionCard.tsx` — Reusable card component
- `MissingRequiredSkillCard.tsx` — Type-specific card
- `SubtypeMismatchCard.tsx` — Type-specific card
- `SeniorityGapCard.tsx` — Type-specific card
- `KnockoutRequirementCard.tsx` — Type-specific card
- `CertificationRiskCard.tsx` — Type-specific card
- `ResumeStyleCard.tsx` — Type-specific card
- `useCards.ts` — Hook to manage card state and submission

### Responsive
- Desktop: Cards in 1–2 column layout
- Mobile: Single column, full-width cards

### Edge Cases
- **Card appears after answering another:** If backend generates a new card dynamically, refresh the card list
- **User navigates away:** Save draft answers (optional enhancement)
- **Network error during submit:** Show retry button, preserve entered answers

---

## Screen 7: Strategy Review (`/strategy-review`)

### Purpose
Show the AI-proposed strategy (target title, emphasis, style, predicted score) before generation. User approves or reopens Decision Board.

### Flow
1. Fetch strategy → `GET /api/v1/sessions/{id}/strategy`
2. Display strategy details
3. User clicks "Approve" → `POST /api/v1/sessions/{id}/approve-strategy`
4. Show loading → State transitions to `GENERATING`
5. Redirect to loading screen (or poll for generation completion)

### Elements

#### Strategy Details
- **Target Title**
  - Label: "Target Job Title"
  - Value: (e.g., "Senior Backend Engineer — Node.js / AWS")

- **Emphasis & Avoid**
  - **Emphasize (Bullet Points):**
    - "Backend systems design"
    - "PostgreSQL optimization"
    - "Microservices architecture"
  - **Avoid (Bullet Points):**
    - "Frontend / UI work"
    - "Mobile development"

- **Per-Role Plan**
  - Description: (e.g., "Highlight distributed systems work from past 3 years; de-emphasize startup phase; focus on fintech experience")

- **Resume Style**
  - Label: "Style"
  - Value: (e.g., "Balanced" or "ATS-Strong")

- **Assumed Defaults**
  - List of auto-resolved cards with explanation
  - (e.g., "Missing optional skill → Will omit from resume")

- **Predicted Score**
  - Gauge / progress bar: 0–100
  - Value: (e.g., "83/100")
  - Breakdown (optional):
    - Required skills coverage: 85%
    - Preferred skills coverage: 70%
    - Seniority alignment: 90%

#### Actions
- **Button 1:** "Approve & Generate Resume"
  - On click → POST approve-strategy, show loading, transition to GENERATING state
  - Disabled until strategy is fully loaded

- **Button 2:** "Adjust Answers"
  - On click → Redirect to `/decision-board` to reopen the board
  - Backend saves partial strategy in case user adjusts

- **Button 3:** "Cancel"
  - On click → Confirm cancellation, redirect to `/profile-selector`

### API Calls
```
GET /api/v1/sessions/{id}/strategy
  Response: {
    success: true,
    data: {
      id: string,
      targetTitle: string,
      emphasis: string[],
      avoid: string[],
      perRolePlan: string,
      style: ResumeStyle,
      assumedDefaults: { cardId: string, action: string, reason: string }[],
      predictedScore: number
    }
  }

POST /api/v1/sessions/{id}/approve-strategy
  Body: {}
  Response: {
    success: true,
    data: { state: "GENERATING" | "VALIDATING", generationStarted: true }
  }
```

### Components
- `StrategyReview.tsx` — Main component
- `StrategyDetails.tsx` — Display strategy info
- `PredictedScoreGauge.tsx` — Visual score display
- `useStrategy.ts` — Hook to fetch/manage strategy

### Responsive
- Desktop: Strategy details in right column, actions on left (or stacked)
- Mobile: Full-width stacked layout

---

## Screen 8: Generation Loading (Conditional)

### When Shown
State is `GENERATING`.

### Purpose
Show feedback while resume is being generated.

### Elements
- **Spinner / Progress Animation**
- **Status Text:** "Generating your tailored resume..."
- **Sub-text:** "This usually takes 10–15 seconds"
- **Optional:** Show generation steps as they complete
  - "Extracting job requirements..." ✓
  - "Matching skills..." ✓
  - "Generating resume content..." (current)
  - "Validating..."

### Polling / Polling Strategy
- Poll `GET /api/v1/sessions/{id}` every 2 seconds
- When state transitions to `VALIDATING` → Redirect to validation loading
- When state transitions to `FINAL_READY` → Redirect to resume preview

### Components
- `GenerationLoading.tsx` — Full screen loader

---

## Screen 9: Validation Loading (Conditional)

### When Shown
State is `VALIDATING`.

### Purpose
Show feedback while resume is being validated.

### Elements
- **Spinner / Progress Animation**
- **Status Text:** "Validating your resume..."
- **Sub-text:** "Checking for unsupported claims, ATS compatibility, and recruiter readability"

### Polling
- Same as generation loading
- When state → `FINAL_READY` or `NEEDS_REVISION` → Redirect accordingly

### Components
- `ValidationLoading.tsx` — Full screen loader

---

## Screen 10: Resume Preview (`/resume-preview`)

### Purpose
Display the generated resume and match report. User can view, download, or export.

### Flow
1. Fetch resume + validation results → `GET /api/v1/sessions/{id}/resume`
2. Display resume (HTML or styled React)
3. Display match report (skill coverage, ATS score, warnings)
4. User downloads DOCX, PDF, or JSON

### Elements

#### Left Column: Resume
- **Resume HTML / Styled Component**
  - Full-sized resume preview
  - Professional formatting
  - Clickable sections (optional: allow edit mode in future)
  - Scrollable if longer than viewport

- **Download Buttons** (sticky bottom or right side)
  - "Download DOCX"
  - "Download PDF"
  - "Download JSON"
  - "Copy to Clipboard" (optional)

#### Right Column: Match Report
- **Match Score**
  - Large gauge: 0–100
  - Color-coded: Green (80+), yellow (60–80), red (<60)
  - Label: (e.g., "83/100 — Strong Match")

- **Skill Coverage Breakdown**
  - **Required Skills:** X/Y covered
    - Progressbar or list
    - Green checkmarks for covered, red X for missing
  - **Preferred Skills:** X/Y covered
    - Similar visual

- **Scores & Metrics**
  - "ATS Score: 88/100"
  - "Recruiter Readability: 85/100"
  - "Seniority Alignment: 90/100"

- **Warnings & Notes** (if any)
  - Red/yellow badges for critical/warning issues
  - E.g., "Missing required skill (Kubernetes) — listed in Skills only, per your decision"
  - E.g., "Seniority mismatch: Job is Senior, your resume presents Mid. This was intentional per your choice."

- **Changes Made**
  - Expandable section listing what was tailored
  - E.g., "Added: Docker, Microservices; Emphasized: System Design; De-emphasized: Startup Phase"
  - Allows user to verify what changed vs. base resume

#### Bottom: Actions
- **Button 1:** "Download Resume" (opens dropdown: DOCX, PDF, JSON)
- **Button 2:** "Save Session" (optional; stores session for later)
- **Button 3:** "Start New Tailoring" → Redirect to `/profile-selector`
- **Button 4:** "View Decision History" (optional; shows cards + decisions)

### API Calls
```
GET /api/v1/sessions/{id}/resume
  Response: {
    success: true,
    data: {
      id: string,
      contentJson: Resume,          // structured resume with per-bullet provenance
      validationResult: {
        contentCheckPassed: boolean,
        atsScore: number,
        recruiterReadabilityScore: number,
        warnings: string[]
      },
      matchReport: {
        overallScore: number,
        requiredSkillsCovered: number / number,
        preferredSkillsCovered: number / number,
        changes: string[],
        decisions: { cardId: string, decision: string, consequence: string }[]
      }
    }
  }

POST /api/v1/sessions/{id}/export
  Body: { format: "docx" | "pdf" | "json" }
  Response: { success: true, data: { downloadUrl: string } }
```

### Components
- `ResumePreview.tsx` — Main container
- `ResumeRenderer.tsx` — Render resume HTML/styled
- `MatchReport.tsx` — Display scores and metrics
- `SkillCoverageBreakdown.tsx` — Skills visual
- `ChangesHighlight.tsx` — List of tailoring changes
- `ExportButton.tsx` — Download dropdown
- `useResume.ts` — Hook to fetch resume

### Responsive
- Desktop: Two-column (resume left, report right)
- Tablet: Stack, resume above report
- Mobile: Full-width stack, small font for resume preview

---

## Screen 11: Navigation & Routing

### Route Structure
```typescript
// app/layout.tsx — Root layout (header, footer, nav)
// app/page.tsx — Landing / Home
// app/(authenticated)/
//   profile-selector/page.tsx
//   jd-input/page.tsx
//   decision-board/page.tsx
//   strategy-review/page.tsx
//   resume-preview/page.tsx
//   sessions/page.tsx — (List user's sessions; future)
// app/error.tsx — Global error boundary
// app/not-found.tsx — 404 page
```

### Session State Based Routing
Frontend should redirect users based on session state:
- `CREATED` → `/jd-input`
- `JD_SUBMITTED` or `ANALYZING` → `/jd-input` (show loading)
- `CATEGORY_REJECTED` → Show rejection screen (can be part of `/jd-input` or own page)
- `WAITING_CATEGORY_CONFIRMATION` → Show confirmation dialog
- `WAITING_SUBTYPE_CONFIRMATION` or `WAITING_SKILL_DECISIONS` → `/decision-board`
- `STRATEGY_REVIEW` → `/strategy-review`
- `GENERATING` or `VALIDATING` → Loading screen (can be modal overlay)
- `FINAL_READY` → `/resume-preview`
- `CANCELLED` → `/profile-selector` (with message)

---

## Component Library (Reusable)

### UI Components (to create in `apps/web/src/components/ui/`)
- `Button.tsx` — Primary, secondary, tertiary variants
- `Input.tsx` — Text input with validation
- `Textarea.tsx` — Multi-line text input
- `Select.tsx` / `Dropdown.tsx` — Dropdown select
- `Radio.tsx` — Radio button group
- `Checkbox.tsx` — Single checkbox or group
- `Modal.tsx` / `Dialog.tsx` — Modal container
- `Toast.tsx` / `Alert.tsx` — Toast notifications
- `Badge.tsx` — Status badge (severity, type, etc.)
- `Spinner.tsx` / `Loader.tsx` — Loading spinner
- `Gauge.tsx` / `ProgressBar.tsx` — Visual progress

### Layout Components (to create in `apps/web/src/components/layout/`)
- `Header.tsx` — Top navigation
- `Footer.tsx` — Bottom footer
- `Sidebar.tsx` — (If needed; optional)
- `Container.tsx` — Max-width wrapper

### Feature Components (to create in `apps/web/src/components/`)
- `ProfileList.tsx` — Display profiles
- `ProfileCard.tsx` — Individual profile
- `DecisionBoard.tsx` — All cards container
- `DecisionCard.tsx` — Single card
- `ResumeRenderer.tsx` — Display resume
- `MatchReport.tsx` — Score breakdown
- etc.

---

## State Management Strategy

### Recommended Approach: React Context + Custom Hooks

```typescript
// contexts/SessionContext.tsx
export const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Methods
  const createSession = async (profileId: string) => { /* ... */ };
  const submitJD = async (sessionId: string, jdText: string) => { /* ... */ };
  const answerCards = async (sessionId: string, decisions: Decision[]) => { /* ... */ };
  // ... etc

  return (
    <SessionContext.Provider value={{ session, loading, error, createSession, submitJD, ... }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be inside SessionProvider');
  return context;
};
```

Usage in components:
```typescript
const MyComponent = () => {
  const { session, loading, submitJD } = useSession();
  // ... use hooks
};
```

### Alternative: React Query (for data fetching)
If you prefer, use React Query for simpler data fetching:
```typescript
// hooks/useSession.ts
import { useQuery, useMutation } from '@tanstack/react-query';

export const useSession = (sessionId: string) => {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3001/api/v1/sessions/${sessionId}`);
      return res.json();
    },
  });
};

export const useSubmitJD = () => {
  return useMutation({
    mutationFn: async ({ sessionId, jdText }: { sessionId: string; jdText: string }) => {
      const res = await fetch(`http://localhost:3001/api/v1/sessions/${sessionId}/jd`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jdText }),
      });
      return res.json();
    },
  });
};
```

---

## Build Order (Recommended)

1. **Shared UI Components** — Create reusable button, input, modal, badge, etc.
2. **Landing Page** — Simple hero + CTA
3. **Profile Selector** — List profiles, create session
4. **JD Input** — Textarea + file upload, submit JD
5. **Decision Board** — Display cards, answer, submit decisions
6. **Strategy Review** — Show strategy, approve/adjust
7. **Resume Preview** — Display resume + match report, export
8. **State Machine Wiring** — Connect all screens; handle state transitions
9. **Error Handling & Loading States** — Make each screen robust
10. **Responsive Design** — Test on mobile, tablet, desktop
11. **Polish & Testing** — End-to-end flow verification

---

## Testing Checklist

### Per Screen
- [ ] All API calls succeed and handle errors
- [ ] Loading states display correctly
- [ ] Error messages are clear and actionable
- [ ] Responsive design works (mobile, tablet, desktop)
- [ ] Accessibility: keyboard navigation, screen reader labels
- [ ] Form validation works (e.g., textarea char limit)

### End-to-End Flow
- [ ] Select profile → Create session
- [ ] Submit JD → Analyze
- [ ] Handle CATEGORY_REJECTED → Offer retry
- [ ] Handle WAITING_CATEGORY_CONFIRMATION → Confirm category
- [ ] Handle WAITING_SKILL_DECISIONS → Show Decision Board
- [ ] Answer cards → Submit
- [ ] Review strategy → Approve
- [ ] Wait for generation → Resume preview
- [ ] Download DOCX / PDF / JSON

### Edge Cases
- [ ] Empty profile list → Show "Create Profile" CTA
- [ ] JD > 15k chars → Disable submit, show warning
- [ ] Network error during analysis → Show retry
- [ ] User navigates away mid-session → Session persists (data not lost)
- [ ] Multiple tabs open → Sync session state across tabs (optional)

---

## API Mocking / Stub Data

For early development (before backend is fully wired), use stub responses:

```typescript
// lib/api-client.ts
const USE_STUB = process.env.NEXT_PUBLIC_USE_STUB === 'true';

export const api = {
  sessions: {
    create: async (profileId: string) => {
      if (USE_STUB) {
        return {
          success: true,
          data: {
            id: 'session-123',
            state: 'JD_SUBMITTED',
            profileId,
            createdAt: new Date(),
          },
        };
      }
      // Real API call
      return fetch(...);
    },
  },
};
```

---

**Last updated:** 2026-07-03  
**Author:** CoTailor Frontend Team
