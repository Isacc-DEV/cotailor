# CoTailor End-to-End Testing Checklist

## Prerequisites

- Backend running: `pnpm --filter @cotailor/api run dev` (port 3001)
- Frontend running: `pnpm --filter @cotailor/web run dev` (port 3000)
- Database initialized with schema
- Postgres running on port 5433

## Happy Path (Full Flow)

### 1. Landing Page
- [ ] Navigate to http://localhost:3000
- [ ] Hero section displays correctly with tagline
- [ ] Features grid shows 6 cards (Fit Gates, Decision Board, etc.)
- [ ] "How It Works" section visible with 5 steps
- [ ] CTA buttons navigate to correct pages
- [ ] Dark mode toggle works (system preference respected)
- [ ] Mobile responsive (test at 375px width)

### 2. Profile Creation
- [ ] Click "Get Started" button on landing page
- [ ] Redirects to `/profile-selector`
- [ ] Empty state shows "No profiles yet"
- [ ] Click "+ Create Profile"
- [ ] Redirects to `/create-profile`
- [ ] Form fields display correctly:
  - [ ] Profile Name (text input)
  - [ ] Category (9-option dropdown)
  - [ ] Seniority (8-level dropdown)
  - [ ] Skills (comma-separated textarea)
  - [ ] Base Resume (large textarea)
- [ ] Form validation:
  - [ ] Submit with empty fields shows errors
  - [ ] Errors clear when user types
  - [ ] Required field indicators present
- [ ] Create profile with valid data:
  - [ ] Success message displays
  - [ ] Redirects to `/profile-selector`
  - [ ] Profile appears in grid
  - [ ] Profile card shows name, category, seniority, first 5 skills

### 3. Session Creation
- [ ] On Profile Selector, click "Select & Start Session" on profile card
- [ ] Button shows loading state during request
- [ ] Session created successfully
- [ ] Redirects to `/jd-input?sessionId=<id>`

### 4. Job Description Input
- [ ] Page displays correctly
- [ ] Title: "Paste Your Job Description"
- [ ] Large textarea with placeholder text
- [ ] Character counter shows current/max (15,000)
- [ ] "Clear" button clears textarea
- [ ] Type job description:
  - [ ] Counter updates as you type
  - [ ] Warning near 15k limit
  - [ ] Disable submit when at limit
- [ ] Click "Analyze Job Description"
- [ ] Button shows loading state
- [ ] API call to `/api/v1/sessions/{id}/jd`
- [ ] Processing takes 30-45 seconds (LoadingScreen shows)
- [ ] Redirects to next state based on analysis

### 5. Category Gates
- [ ] **High Confidence Match:** Redirects directly to `/decision-board`
- [ ] **Low Confidence (<80%):**
  - [ ] Redirects to `/category-confirmation`
  - [ ] Shows profile category vs detected category
  - [ ] Shows confidence percentage
  - [ ] Two options: "Try With [Detected]" or "Continue With [Profile]"
  - [ ] Selecting option navigates correctly
- [ ] **No Match (Hard Reject):**
  - [ ] Redirects to `/category-rejected`
  - [ ] Shows mismatch cards with red highlight
  - [ ] Explains why mismatch matters
  - [ ] Offers two options:
    - [ ] "Back to Profile Selector"
    - [ ] "Try Another JD" (re-open JD input)

### 6. Soft Gates & Decision Board
- [ ] Redirects to `/decision-board?sessionId=<id>`
- [ ] Displays "Decision Board" title
- [ ] Shows pending cards:
  - [ ] Card type badge (category_low_confidence, subtype_mismatch, etc.)
  - [ ] Severity badge (info, warning, blocking, critical)
  - [ ] Card title and description
  - [ ] Options as radio buttons or checkboxes
  - [ ] "Answered" checkmark when selected
- [ ] **Assumed Defaults section:**
  - [ ] Auto-resolved cards listed
  - [ ] Collapsible/expandable
- [ ] Answer all cards:
  - [ ] Radio buttons work
  - [ ] Checkboxes work
  - [ ] Select all options on all cards
- [ ] "Review Strategy" button enabled
- [ ] All answered state shows success message
- [ ] Click "Review Strategy"

### 7. Strategy Review
- [ ] Redirects to `/strategy-review?sessionId=<id>`
- [ ] AI-proposed strategy displays:
  - [ ] Target job title
  - [ ] Emphasis list (skills/experiences to highlight)
  - [ ] Avoid list (sensitive/irrelevant items)
  - [ ] Per-role tailoring plan
  - [ ] Predicted match score (circular gauge)
- [ ] Match score color-coded:
  - [ ] Green (80-100%)
  - [ ] Yellow (60-79%)
  - [ ] Red (<60%)
- [ ] "Approve & Generate" button
- [ ] "Adjust Answers" button reopens Decision Board
- [ ] Click "Approve & Generate"
- [ ] Button shows loading state
- [ ] Redirects to resume generation (LoadingScreen 45-60s)

### 8. Resume Preview
- [ ] Redirects to `/resume-preview?sessionId=<id>`
- [ ] Two-column layout (resume + match report):
  - [ ] Left column: Resume content
  - [ ] Right column: Match report
- [ ] Resume renders with:
  - [ ] Sections (Experience, Education, etc.)
  - [ ] Bullet points
  - [ ] Provenance badges (profile_verified, user_confirmed, omitted)
  - [ ] Omitted bullets struck-through and faded
  - [ ] Skills organized by category
- [ ] Match report shows:
  - [ ] Required skill coverage % (progress bar)
  - [ ] Preferred skill coverage %
  - [ ] ATS score (0-100)
  - [ ] Recruiter readability score
  - [ ] Warnings section
  - [ ] Changes made from base resume
- [ ] Export buttons:
  - [ ] "Download as DOCX"
  - [ ] "Download as PDF"
  - [ ] "Copy JSON"

### 9. Session History
- [ ] Navigate to `/session-history`
- [ ] Lists all sessions:
  - [ ] Completed sessions (green badge)
  - [ ] In-progress sessions (blue badge)
  - [ ] Abandoned sessions (gray badge)
- [ ] Filter buttons:
  - [ ] All Sessions
  - [ ] Completed
  - [ ] In Progress
- [ ] Each session card shows:
  - [ ] Job title
  - [ ] Company name
  - [ ] Profile name
  - [ ] Created date (human-readable: "2h ago", "Yesterday", etc.)
  - [ ] Match score (if completed)
  - [ ] Progress (if in progress)
- [ ] Actions:
  - [ ] Completed: "View Resume" and "Export" buttons
  - [ ] In Progress: "Continue" button
  - [ ] Abandoned: "Start New Session" button
- [ ] Click on session navigates correctly

### 10. Navigation
- [ ] Header visible on all pages
- [ ] Logo clickable, goes to home
- [ ] Nav links highlight current page
- [ ] "New Session" button always visible
- [ ] Mobile hamburger menu appears at 768px
- [ ] Mobile menu items functional
- [ ] Footer visible on all pages
- [ ] Footer links functional

### 11. Styling & Responsive
- [ ] All pages load without layout shifts
- [ ] Dark mode works across all pages
- [ ] Mobile responsive at breakpoints:
  - [ ] 375px (small phone)
  - [ ] 768px (tablet)
  - [ ] 1024px (desktop)
- [ ] Form inputs have focus states (green border)
- [ ] Buttons have hover states
- [ ] Spinners animate smoothly
- [ ] Modals have overlay and center correctly

## Error Handling

### API Errors
- [ ] Network error: Shows error message, retry option
- [ ] Timeout (>30s): Shows timeout message
- [ ] 400 Bad Request: Shows specific validation error
- [ ] 404 Not Found: Redirects to 404 page
- [ ] 500 Server Error: Shows error message

### 404 Page
- [ ] Navigate to non-existent route (e.g., `/doesntexist`)
- [ ] Shows 404 error page
- [ ] Offers navigation options:
  - [ ] "Go Home"
  - [ ] "Go Back"
  - [ ] Links to profile selector, session history

### Form Validation
- [ ] Profile creation with missing fields shows errors
- [ ] Errors clear when user types
- [ ] JD input character limit prevents submit at 15k
- [ ] Decision cards require all answers before submit

## Browser Compatibility

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Performance

- [ ] Initial page load <3s
- [ ] Navigation between pages <1s
- [ ] Form submission <2s
- [ ] API calls timeout after 30s (with visible indicator)
- [ ] No console errors or warnings
- [ ] No memory leaks (check DevTools)

## Accessibility

- [ ] Keyboard navigation (Tab through all interactive elements)
- [ ] Focus states visible on all buttons
- [ ] Color contrast meets WCAG AA (test with DevTools)
- [ ] Form labels associated with inputs
- [ ] Error messages linked to fields
- [ ] Button text clear (not "Click here")
- [ ] Images have alt text
- [ ] Screen reader friendly (test with NVDA/JAWS)

## Edge Cases

- [ ] Empty profiles list
- [ ] Profile with very long name (truncate/wrap)
- [ ] Resume with 100+ bullet points (pagination/scroll)
- [ ] Job description with special characters
- [ ] Very low match score (<20%)
- [ ] Perfect match (100%)
- [ ] Profile with no skills
- [ ] Multiple sessions for same profile
- [ ] Session from 1+ hours ago (cache behavior)
- [ ] Browser tab closed during API request

## Regression Tests

After each change, verify:
- [ ] Landing page still renders
- [ ] Can create a profile
- [ ] Can start a session
- [ ] Can submit JD
- [ ] Can answer cards
- [ ] Can review strategy
- [ ] Can generate resume
- [ ] Can view history
- [ ] Navigation works
- [ ] Dark mode works

## Sign-Off

- [ ] All happy path tests pass
- [ ] All error handling tests pass
- [ ] All accessibility tests pass
- [ ] No console errors
- [ ] No layout shifts
- [ ] Mobile responsive
- [ ] Dark mode works
- [ ] Performance acceptable

**Tester:** ________________  
**Date:** ________________  
**Sign-off:** ________________
