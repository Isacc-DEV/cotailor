# CoTailor - Complete Project Guide

## ? PROJECT STATUS: READY FOR PRODUCTION

**Latest Build:** All components, pages, and authentication system complete and integrated.

---

## ?? WHAT HAS BEEN BUILT

### Authentication System
- **Sign Up Page** (`/auth/signup`) - Create new account with email/password
- **Sign In Page** (`/auth/signin`) - Sign in with existing credentials
- **Auth Context** - Global authentication state management
- **Protected Routes** - Header shows auth/user buttons conditionally

### Complete User Journey (14 Pages)

1. **Landing Page** (`/`) - Hero, features, how-it-works, demo
2. **Sign Up** (`/auth/signup`) - Create account
3. **Sign In** (`/auth/signin`) - Login
4. **Profile Selector** (`/profile-selector`) - Choose profile to start
5. **Create Profile** (`/create-profile`) - New profile form
6. **Profile Editor** (`/profile-editor`) - Edit/delete profiles
7. **JD Input** (`/jd-input`) - Submit job description
8. **Decision Board** (`/decision-board`) - Answer decision cards
9. **Category Confirmation** (`/category-confirmation`) - Soft gate dialog
10. **Category Rejected** (`/category-rejected`) - Hard gate failure
11. **Strategy Review** (`/strategy-review`) - Review AI strategy
12. **Resume Preview** (`/resume-preview`) - View & export resume
13. **Session History** (`/session-history`) - View all past sessions
14. **404 Page** - Error handling

### UI Components (10+ Ready)
- Button (5 variants: primary, secondary, tertiary, danger, ghost)
- Card (with hover effects)
- Badge (5 variants: info, warning, success, error, default)
- Spinner (loading indicator)
- Decision Card (for displaying decisions)
- Subtype Confirmation Modal
- Loading Screen (with phases)
- Header (responsive, auth-aware)
- Footer (4-column layout)

### Custom Hooks (5 Complete)
- `useProfiles` - Profile CRUD operations
- `useSession` - Session management
- `useCards` - Decision card answering
- `useStrategy` - Strategy review
- `useResume` - Resume generation & export

### Infrastructure
- API Client (`lib/api-client.ts`) - All endpoints wrapped
- Type Definitions (`lib/types.ts`) - 15+ TypeScript interfaces
- Session Context - Session state management
- Auth Context - Authentication state & user
- CSS Modules with Dark Mode on all pages
- Responsive Mobile-First Design

### Styling
- **Light Mode** - Professional cream/gray palette
- **Dark Mode** - Automatically applied via `@media (prefers-color-scheme: dark)`
- **Responsive** - Optimized for 375px (mobile), 768px (tablet), 1024px (desktop)
- **Accessibility** - Focus states, color contrast, semantic HTML

---

## ?? HOW TO RUN

### Prerequisites
- Node.js 20+
- PostgreSQL 16 running on port 5433
- User: cotailor, Database: cotailor

### Start Development

\`\`\`bash
cd "d:\Code\tailor resume"

# Install dependencies
pnpm install

# Generate Prisma client
pnpm run prisma:generate

# Start both frontend and backend
pnpm dev
\`\`\`

**Frontend:** http://localhost:3000  
**Backend API:** http://localhost:3001

---

## ?? COMPLETE FILE STRUCTURE

### Frontend (Next.js 15)
\`\`\`
apps/web/
+-- app/
¦   +-- (pages)
¦   ¦   +-- page.tsx                    Landing page
¦   ¦   +-- auth/
¦   ¦   ¦   +-- signup/page.tsx         Sign up form
¦   ¦   ¦   +-- signin/page.tsx         Sign in form
¦   ¦   ¦   +-- auth.css
¦   ¦   +-- profile-selector/
¦   ¦   ¦   +-- page.tsx
¦   ¦   ¦   +-- page.css
¦   ¦   +-- create-profile/
¦   ¦   ¦   +-- page.tsx
¦   ¦   ¦   +-- page.css
¦   ¦   +-- profile-editor/
¦   ¦   ¦   +-- page.tsx
¦   ¦   ¦   +-- page.css
¦   ¦   +-- jd-input/
¦   ¦   ¦   +-- page.tsx
¦   ¦   ¦   +-- page.css
¦   ¦   +-- decision-board/
¦   ¦   ¦   +-- page.tsx
¦   ¦   ¦   +-- page.css
¦   ¦   +-- strategy-review/
¦   ¦   ¦   +-- page.tsx
¦   ¦   ¦   +-- page.css
¦   ¦   +-- resume-preview/
¦   ¦   ¦   +-- page.tsx
¦   ¦   ¦   +-- page.css
¦   ¦   +-- category-confirmation/
¦   ¦   ¦   +-- page.tsx
¦   ¦   ¦   +-- page.css
¦   ¦   +-- category-rejected/
¦   ¦   ¦   +-- page.tsx
¦   ¦   ¦   +-- page.css
¦   ¦   +-- session-history/
¦   ¦   ¦   +-- page.tsx
¦   ¦   ¦   +-- page.css
¦   ¦   +-- not-found.tsx               404 page
¦   ¦   +-- error.css
¦   +-- components/
¦   ¦   +-- ui/
¦   ¦   ¦   +-- Button.tsx              5 variants
¦   ¦   ¦   +-- Card.tsx
¦   ¦   ¦   +-- Badge.tsx               5 variants
¦   ¦   ¦   +-- Spinner.tsx
¦   ¦   ¦   +-- Button.css, Card.css, Badge.css, Spinner.css
¦   ¦   +-- layout/
¦   ¦   ¦   +-- Header.tsx              Auth-aware header
¦   ¦   ¦   +-- Footer.tsx
¦   ¦   ¦   +-- header.css, footer.css
¦   ¦   +-- cards/
¦   ¦   ¦   +-- DecisionCard.tsx
¦   ¦   ¦   +-- SubtypeConfirmation.tsx
¦   ¦   +-- screens/
¦   ¦       +-- LoadingScreen.tsx
¦   +-- hooks/
¦   ¦   +-- useProfiles.ts              Profile CRUD
¦   ¦   +-- useSession.ts               Session management
¦   ¦   +-- useCards.ts                 Card answering
¦   ¦   +-- useStrategy.ts              Strategy operations
¦   ¦   +-- useResume.ts                Resume operations
¦   +-- context/
¦   ¦   +-- SessionContext.tsx          Session state
¦   ¦   +-- AuthContext.tsx             Auth & user state
¦   +-- styles/
¦   ¦   +-- subtype-confirmation.css
¦   ¦   +-- loading-screen.css
¦   +-- layout.tsx                      Root layout (with providers)
¦   +-- page.css                        Landing page styles
¦   +-- page.tsx                        Landing page
¦   +-- globals.css                     Global styles
+-- lib/
¦   +-- api-client.ts                   All API endpoints
¦   +-- types.ts                        TypeScript definitions
+-- .env.example
\`\`\`

### Backend (NestJS 10)
- **Status:** Already built and running
- **Endpoints:** All mapped and ready
- **Database:** Prisma ORM with PostgreSQL
- **State Machine:** Enforced in backend

---

## ?? AUTHENTICATION FLOW

### Sign Up
1. User fills email, password, name
2. Form validates (8+ char password, email format)
3. POST to `/api/v1/auth/signup`
4. Token stored in localStorage
5. Redirects to profile selector

### Sign In
1. User enters email & password
2. Form validates
3. POST to `/api/v1/auth/signin`
4. Token stored in localStorage
5. Redirects to profile selector

### Sign Out
1. Click "Sign Out" in header
2. Token removed from localStorage
3. User cleared from context
4. Redirects to home

### Protected Areas
- Header shows "Sign In / Sign Up" if not authenticated
- Header shows user name + "New Session" + "Sign Out" if authenticated
- Protected routes check `useAuth()` hook

---

## ?? USER JOURNEY (COMPLETE FLOW)

\`\`\`
1. Land on / (home page)
   ?
2. Click "Sign Up" or "Get Started"
   ?
3. Fill sign up form ? account created
   ?
4. Redirected to /profile-selector
   ?
5. Click "+ Create Profile"
   ?
6. Fill profile form (name, category, seniority, skills, resume)
   ?
7. Profile created ? back to /profile-selector
   ?
8. Click "Select & Start Session"
   ?
9. Redirected to /jd-input?sessionId=...
   ?
10. Paste job description ? click "Analyze"
    ?
11. (Analysis runs for 30-45 seconds)
    ?
12. Redirected based on gates:
    - If perfect match ? /decision-board
    - If low confidence ? /category-confirmation
    - If hard reject ? /category-rejected
    ?
13. /decision-board (answer cards)
    ?
14. Click "Review Strategy"
    ?
15. /strategy-review (see AI plan)
    ?
16. Click "Approve & Generate"
    ?
17. (Generation runs 45-60 seconds)
    ?
18. /resume-preview (view resume + match report)
    ?
19. Click "Download as DOCX/PDF/JSON"
    ?
20. Resume exported
\`\`\`

---

## ??? DEVELOPMENT PATTERNS

### Adding a New Page
1. Create `app/<page-name>/page.tsx`
2. Create `app/<page-name>/page.css`
3. Add to Header navigation if needed
4. Use hooks for data fetching

### Using Hooks
\`\`\`typescript
import { useProfiles } from '@/app/hooks/useProfiles';

export default function MyComponent() {
  const { profiles, loading, error, createProfile } = useProfiles();
  // ... use the hook
}
\`\`\`

### Making API Calls
\`\`\`typescript
import { api } from '@/lib/api-client';

// All methods available:
await api.profiles.list();
await api.profiles.create(data);
await api.sessions.submitJD(sessionId, jdText);
// ... etc
\`\`\`

### Checking Authentication
\`\`\`typescript
import { useAuth } from '@/app/context/AuthContext';

export default function MyComponent() {
  const { user, isAuthenticated, signOut } = useAuth();
  
  if (!isAuthenticated) return <div>Please sign in</div>;
  return <div>Hello, {user?.name}</div>;
}
\`\`\`

---

## ?? RESPONSIVE DESIGN

All pages optimized for:
- **Mobile:** 375px (iPhone SE)
- **Tablet:** 768px breakpoint
- **Desktop:** 1024px+

Dark mode automatically applied based on system preference (`@media (prefers-color-scheme: dark)`).

---

## ? STYLING

### Color Palette
- **Accent:** #059669 (green)
- **Text (light):** #1c1c1c
- **Text (dark):** #f5f5f4
- **Muted (light):** #78716f
- **Muted (dark):** #a8a39d
- **Background:** #f5f5f4 / #27251f
- **Borders:** #e7e5e4 / #44403c

### Components Use CSS Modules
- Light mode defaults
- Dark mode via `@media (prefers-color-scheme: dark)`
- Mobile responsive via `@media (max-width: 768px)`

---

## ?? TESTING

See `E2E_TEST_CHECKLIST.md` for 100+ test cases covering:
- Happy path (full flow)
- Error handling
- Browser compatibility
- Accessibility
- Performance
- Edge cases

---

## ?? DOCUMENTATION

- **CLAUDE.md** - Architecture & design decisions
- **FRONTEND_DEV_GUIDE.md** - Frontend development patterns
- **E2E_TEST_CHECKLIST.md** - Complete testing guide
- **COMPLETE_PROJECT_GUIDE.md** - This file

---

## ?? KEY FILES TO KNOW

- **api-client.ts** - ALL API endpoints (profiles, sessions, etc.)
- **AuthContext.tsx** - Authentication state & logic
- **useProfiles.ts** - Profile operations
- **layout.tsx** - Root layout with AuthProvider & SessionProvider
- **Header.tsx** - Responsive header with auth-aware buttons

---

## ?? NEXT STEPS (IF NEEDED)

### To Deploy
1. Build: `pnpm run build`
2. Use a hosting service (Vercel for frontend, any Node host for backend)
3. Set environment variables
4. Deploy

### To Add Features
1. **New page?** Create in `app/` with `.tsx` and `.css`
2. **New hook?** Create in `app/hooks/` with data fetching logic
3. **New component?** Create in `app/components/` with types
4. **New API endpoint?** Add to `lib/api-client.ts`

### To Fix Bugs
1. Check browser console for errors
2. Check Network tab for API failures
3. Verify backend is running on :3001
4. Check localStorage for auth token

---

## ?? SUPPORT

If something isn't working:
1. Check the error message in console
2. Verify both servers are running (`pnpm dev`)
3. Clear browser cache & localStorage
4. Restart the dev servers
5. Check that PostgreSQL is running

---

**Project Status:** ? COMPLETE & READY FOR USE
**Last Updated:** 2026-07-03
