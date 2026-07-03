# CoTailor End-to-End Testing Guide

> **Complete walkthrough to test the full user journey from profile selection to resume export.**

**Date:** 2026-07-03  
**Status:** All frontend screens built and ready to test

---

## Prerequisites

Before starting, ensure:

✅ Node.js 20+  
✅ pnpm 11.9+  
✅ PostgreSQL 16 running on 127.0.0.1:5433  
✅ Database schema initialized (17 tables)  
✅ Both apps can start (`pnpm dev`)  

### Quick Setup (if not done)

```bash
cd "d:\Code\tailor resume"
pnpm install
pnpm run prisma:generate
pnpm run typecheck
```

---

## Starting the Apps

### Terminal 1: Start Both Apps
```bash
pnpm dev
```

Wait for output:
```
apps/web dev: ▲ Next.js 15.5.20
apps/web dev: - Local:        http://localhost:3000
apps/api dev: [Nest] ... Nest application successfully started
```

### Terminal 2: Monitor Backend (Optional)
```bash
cd apps/api
npm run dev
```

### Browser
Open **http://localhost:3000** in your browser.

---

## Test Flow 1: Create Test Profile + Start Session

### Step 1: Create a Test Profile via API

In a new terminal or Postman, create a profile:

```bash
curl -X POST http://localhost:3001/api/v1/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backend Engineer — Node.js",
    "category": "Software Engineering",
    "seniority": "senior",
    "skills": ["Node.js", "PostgreSQL", "AWS", "Docker", "Kubernetes"],
    "baseResume": "## Experience\n\n### TechCo (2020-Present)\n- Designed and built microservices architecture using Node.js\n- Managed PostgreSQL databases with 100M+ records\n- Deployed to AWS using Docker and Kubernetes\n- Led 5-engineer team on backend systems\n\n## Education\nBS Computer Science, State University"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "profile-uuid-here",
    "name": "Backend Engineer — Node.js",
    "category": "Software Engineering",
    "seniority": "senior",
    "skills": ["Node.js", "PostgreSQL", "AWS", "Docker", "Kubernetes"]
  }
}
```

**Save the profile ID** — you'll need it next.

### Step 2: Open Profile Selector in Browser

Navigate to: **http://localhost:3000/profile-selector**

**Expected Behavior:**
- [ ] Page loads with title "Select Your Profile"
- [ ] Your newly created profile appears as a card
- [ ] Card shows name, category badge, seniority badge, and skills preview
- [ ] Card is hoverable (slight shadow/transform on hover)

### Step 3: Select Profile

**Click "Select & Start Session"** on the profile card.

**Expected Behavior:**
- [ ] Button shows loading spinner
- [ ] After ~1 second, redirects to `/jd-input?sessionId=...`
- [ ] URL contains a session ID (check the URL bar)

---

## Test Flow 2: Submit Job Description

### Step 1: You're Now on JD Input Screen

**Expected Layout:**
- [ ] Header: "Paste Job Description"
- [ ] Large textarea for pasting JD
- [ ] Character counter showing "0 / 15000"
- [ ] "Clear" button (disabled until text entered)
- [ ] "Analyze Job Description" button (disabled until text entered)
- [ ] Help text with bullet points on what to include

### Step 2: Paste a Sample JD

Copy and paste this job description into the textarea:

```
Senior Full Stack Engineer — FinTech (Payments)

We're looking for a Senior Full Stack Engineer to build our next-generation payment processing platform. You'll work on both backend systems (Node.js, PostgreSQL) and frontend (React, Vue.js).

Requirements:
- 5+ years of software engineering experience
- Strong backend skills (Node.js, Express, or similar)
- PostgreSQL or similar relational database experience
- React or Vue.js frontend experience
- AWS or GCP cloud platform experience
- Docker and Kubernetes for containerization
- Experience with microservices architecture
- Git and CI/CD pipelines (GitHub Actions, GitLab CI, or Jenkins)

Preferred:
- FinTech or payments domain experience
- Kubernetes cluster management
- GraphQL API design
- TypeScript expertise
- Stripe, PayPal, or similar payment API integration
- Load testing and performance optimization

Responsibilities:
- Design and implement backend APIs for payment processing
- Build responsive frontend interfaces for merchant dashboard
- Optimize database queries and system performance
- Mentor junior engineers
- Participate in code reviews and architecture decisions
- Deploy and monitor applications in production

Nice to Have:
- Open source contributions
- Technical writing (blog posts, documentation)
- Conference speaking experience
```

**Expected Behavior:**
- [ ] Text appears in textarea
- [ ] Character counter updates (should show ~1,200+ characters)
- [ ] Clear button becomes enabled
- [ ] "Analyze Job Description" button becomes enabled

### Step 3: Click "Analyze Job Description"

**Expected Behavior:**
- [ ] Button shows loading spinner + "Analyzing..."
- [ ] Page may show loading spinner overlay
- [ ] After ~2-3 seconds (API processes JD), page navigates

**Navigation Depends on Analysis Result:**
- If category matches: → `/decision-board?sessionId=...`
- If category doesn't match: → Category mismatch screen (error state)
- If low confidence: → Category confirmation dialog

**For this test**, the job is "Senior Full Stack" and profile is "Backend Engineer — Node.js", so:
- **Expected:** Navigate to Decision Board
- **If not:** Check backend logs for analysis errors

---

## Test Flow 3: Answer Decision Cards

### Step 1: Decision Board Screen Loads

**Expected Layout:**
- [ ] Header: "Decision Board"
- [ ] Subtitle: "Answer the questions below to tailor your resume"
- [ ] Section: "Assumed Defaults" (if any auto-resolved cards) with green background
- [ ] Section: "Your Decisions" showing pending cards
- [ ] Card count: "X decision(s) remaining"
- [ ] "Review Strategy" button (disabled until all cards answered)

### Step 2: Identify Pending Cards

Depending on your profile vs. the JD, you may see cards like:

1. **"Subtype Mismatch"** — Backend vs Full Stack
2. **"Missing Required Skill"** — Kubernetes (if not in profile)
3. **"Seniority Gap"** — If seniority doesn't match
4. Other skill-related cards

**For each card:**
- [ ] Card displays question clearly
- [ ] Severity badge shows (info/warning/blocking/critical)
- [ ] Radio button options are visible
- [ ] Descriptions explain each choice

### Step 3: Answer Each Card

For **"Subtype Mismatch"** card (Full Stack vs Backend):
- [ ] Select option: "Yes, Generate Anyway"
- [ ] Option becomes highlighted
- [ ] Card shows checkmark (✓) in top right

For **"Missing Required Skill"** card (e.g., Kubernetes):
- [ ] Select option: "Skills Only" (safest choice for testing)
- [ ] Card shows checkmark

For other cards:
- [ ] Answer with reasonable choices
- [ ] Watch card status update to "answered"

### Step 4: Check "Review Strategy" Button

- [ ] As you answer cards, button should become enabled
- [ ] When all pending cards are answered, button is bright green and clickable
- [ ] Card count updates: "0 decisions remaining"

### Step 5: Click "Review Strategy"

**Expected Behavior:**
- [ ] Page navigates to `/strategy-review?sessionId=...`
- [ ] Shows loading spinner briefly if strategy isn't ready yet

---

## Test Flow 4: Review & Approve Strategy

### Step 1: Strategy Review Screen Loads

**Expected Layout:**

**Left Column:**
- [ ] "Target Job Title" section showing proposed title
- [ ] "What to Emphasize" list (bullet points)
- [ ] "What to De-emphasize" list (red/muted color)
- [ ] "Tailoring Plan" narrative description
- [ ] "Resume Style" badge (ats_strong, recruiter_friendly, or balanced)

**Right Column (Sticky):**
- [ ] "Predicted Match Score" card with:
  - [ ] Large circular gauge (0–100)
  - [ ] Color-coded (green/yellow/red based on score)
  - [ ] Progress bar below gauge
  - [ ] Label: "Strong/Fair/Weak Match"

**Assumed Defaults Section:**
- [ ] Shows auto-resolved cards with checkmarks
- [ ] Green background (#f0fdf4)

**Action Buttons:**
- [ ] "← Adjust Answers" (secondary, on left)
- [ ] "Approve & Generate Resume" (primary, on right)

### Step 2: Review the Strategy

- [ ] Read the target title — does it make sense?
- [ ] Check emphasis/avoid lists — are they relevant?
- [ ] Review predicted score — is it reasonable?
  - High score (80+) = good fit
  - Medium score (60–80) = moderate fit
  - Low score (<60) = poor fit (you can still approve)

### Step 3: Click "Approve & Generate Resume"

**Expected Behavior:**
- [ ] Button shows loading spinner
- [ ] Button text: "Approving..."
- [ ] After ~2-3 seconds, navigates to `/resume-preview?sessionId=...`
- [ ] May show loading screen briefly: "Generating your resume..."

---

## Test Flow 5: View Resume & Match Report

### Step 1: Resume Preview Screen Loads

**Expected Layout:**

**Left Column (Resume Document):**
- [ ] White/dark background (matches theme)
- [ ] **Profile Header** with name and title
- [ ] **Experience Section** with:
  - [ ] Job title, company, duration
  - [ ] Bullet points with **provenance badges**
    - Green left border + "profile verified" badge
    - Blue left border + "user confirmed" badge
    - Struck-through + faded if "omitted"
- [ ] **Skills Section** organized by category
- [ ] **Education Section** (if included in base resume)

**Export Buttons Below Resume:**
- [ ] "Download DOCX" button
- [ ] "Download PDF" button
- [ ] "Download JSON" button

**Right Column (Match Report - Sticky):**
- [ ] **Match Score** gauge (0–100)
- [ ] **Validation Results** card:
  - [ ] Content Check: Passed/Failed badge
  - [ ] ATS Score: 0–100
  - [ ] Recruiter Readability: 0–100
- [ ] **Skills Coverage:**
  - [ ] Required skills: X/Y (with progress bar)
  - [ ] Preferred skills: X/Y (with progress bar)
- [ ] **Warnings Section** (if any, yellow background)
- [ ] **Changes Made** list

**Action Button:**
- [ ] "Start New Tailoring" at bottom

### Step 2: Examine the Resume

- [ ] **Provenance markers** on bullets make sense
- [ ] **Omitted bullets** are struck-through (if any)
- [ ] **Skills section** includes both required and optional
- [ ] No fabricated skills or experience

### Step 3: Check Match Report

- [ ] **Match score** reflects fit (should be high if you answered cards well)
- [ ] **Content Check** passed = no fabricated claims
- [ ] **ATS & Readability scores** are reasonable
- [ ] **Skills Coverage** shows x/y for required and preferred
- [ ] **Changes Made** list shows what was tailored

### Step 4: Test Export (Optional)

Click **"Download JSON"** button:
- [ ] Button shows loading state briefly
- [ ] May trigger browser download or show success message
- [ ] (DOCX/PDF export may not work without backend integration yet)

### Step 5: Start New Session

Click **"Start New Tailoring"**:
- [ ] Navigates back to `/profile-selector`
- [ ] Ready to start another session

---

## Test Flow Summary

```
✅ Create Profile (via API)
  ↓
✅ Profile Selector (list & select)
  ↓
✅ JD Input (paste & analyze)
  ↓
✅ Decision Board (answer cards)
  ↓
✅ Strategy Review (approve strategy)
  ↓
✅ Resume Preview (view & export)
  ↓
✅ Start New Tailoring (loop back)
```

---

## Checklist: What Should Work

### Frontend Navigation
- [ ] All 6 screens are accessible and render without errors
- [ ] Navigation between screens works
- [ ] Query parameters (sessionId) are preserved correctly
- [ ] Loading states show during API calls
- [ ] Error messages display if API calls fail

### UI Components
- [ ] Buttons show hover/active states
- [ ] Cards are properly styled and responsive
- [ ] Badges display correct colors
- [ ] Dark mode works (toggle in browser dev tools or OS settings)
- [ ] Mobile layout is responsive (test with browser resize or device emulation)

### API Integration
- [ ] Profile creation works
- [ ] Session creation works
- [ ] JD submission/analysis works
- [ ] Card fetching works
- [ ] Card answer submission works
- [ ] Strategy fetching works
- [ ] Strategy approval works
- [ ] Resume fetching works

### Data Display
- [ ] Resume displays correctly with formatting
- [ ] Provenance badges are visible and color-coded
- [ ] Match report scores are displayed
- [ ] Assumed defaults section shows correctly
- [ ] Skills are organized by category

---

## Troubleshooting

### Issue: "Profile Selector shows empty list"
**Solution:** Create a profile via API (Step 1 above) or check:
- Is the API running? (`curl http://localhost:3001/health`)
- Is the database initialized? (`psql ... \dt`)

### Issue: "JD Input doesn't redirect after submit"
**Solution:** Check backend logs:
- API may be failing to analyze JD
- Check: `curl http://localhost:3001/api/v1/sessions/{sessionId}`
- Is analysis job running?

### Issue: "Decision Board shows no cards"
**Solution:** Check:
- Did the analysis complete? (May still be ANALYZING state)
- Refresh the page
- Check browser console for API errors

### Issue: "Resume shows 'No resume available'"
**Solution:** 
- Strategy may still be generating
- Check backend logs for generation errors
- Verify all cards were answered and strategy was approved

### Issue: "Buttons are disabled when they shouldn't be"
**Solution:**
- Check if an API call is in progress (loading state)
- Open browser console for JS errors
- Check network tab for failed requests

---

## API Endpoints Being Tested

| Endpoint | Method | Status |
|----------|--------|--------|
| `POST /api/v1/profiles` | Create profile | ✅ |
| `GET /api/v1/profiles` | List profiles | ✅ |
| `POST /api/v1/sessions` | Create session | ✅ |
| `GET /api/v1/sessions/{id}` | Get session state | ✅ |
| `POST /api/v1/sessions/{id}/jd` | Submit JD | ✅ |
| `GET /api/v1/sessions/{id}/cards` | Fetch cards | ✅ |
| `POST /api/v1/sessions/{id}/cards/{id}/answer` | Answer card | ✅ |
| `GET /api/v1/sessions/{id}/strategy` | Fetch strategy | ✅ |
| `POST /api/v1/sessions/{id}/approve-strategy` | Approve strategy | ✅ |
| `GET /api/v1/sessions/{id}/resume` | Fetch resume | ✅ |
| `POST /api/v1/sessions/{id}/export` | Export resume | ⚠️ (optional) |

---

## Next Steps After Testing

### If All Tests Pass ✅
- **Frontend is production-ready** for demo/MVP
- Backend endpoints are working
- Full user journey works end-to-end
- Ready to deploy!

### If Any Tests Fail ❌
- Check backend logs: `apps/api/` in terminal
- Verify API response format matches frontend expectations
- Check database for missing data
- Refer to CLAUDE.md for API contract

---

**Happy Testing! 🎉**

Report any issues in the troubleshooting section or check backend logs.

