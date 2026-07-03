# CoTailor Frontend Development Guide

## Quick Start

```bash
# Install dependencies (from root)
pnpm install

# Start dev server
pnpm dev

# Open http://localhost:3000 in browser
```

## Project Structure

```
apps/web/src/
├── app/
│   ├── (pages)
│   │   ├── page.tsx              Landing page
│   │   ├── profile-selector/
│   │   ├── create-profile/
│   │   ├── profile-editor/
│   │   ├── jd-input/
│   │   ├── decision-board/
│   │   ├── strategy-review/
│   │   ├── resume-preview/
│   │   ├── category-rejected/
│   │   ├── category-confirmation/
│   │   └── session-history/
│   ├── components/
│   │   ├── ui/                   Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Spinner.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   ├── cards/
│   │   │   ├── DecisionCard.tsx
│   │   │   └── SubtypeConfirmation.tsx
│   │   └── screens/
│   │       └── LoadingScreen.tsx
│   ├── hooks/
│   │   ├── useSession.ts
│   │   ├── useProfiles.ts
│   │   ├── useCards.ts
│   │   ├── useStrategy.ts
│   │   └── useResume.ts
│   ├── context/
│   │   └── SessionContext.tsx
│   ├── layout.tsx                Root layout (with Header, Footer, SessionProvider)
│   └── globals.css
├── lib/
│   ├── api-client.ts             API fetch wrapper
│   └── types.ts                  TypeScript type definitions
└── styles/
    ├── subtype-confirmation.css
    └── loading-screen.css
```

## Component Pattern

All page and component files follow this pattern:

```typescript
'use client'; // Client component

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Badge } from '@/app/components/ui';
import './page.css';

export default function ComponentName() {
  // State
  const [state, setState] = useState(null);
  const router = useRouter();

  // Effects
  useEffect(() => {
    // Load data
  }, []);

  // Handlers
  const handleAction = () => {
    // Do something
  };

  // Render
  return (
    <div className="component-name">
      {/* Content */}
    </div>
  );
}
```

## Styling Guidelines

- **CSS Modules**: One `.css` file per page/component, co-located
- **Dark Mode**: All styles support `@media (prefers-color-scheme: dark)` automatically
- **Responsive**: Mobile-first design with breakpoint at `768px`
- **Colors**: Use project palette (greens for success, reds for errors, grays for neutral)
- **Spacing**: Use rem units, consistent 0.25rem base scale

Example:

```css
/* Light mode (default) */
.component {
  background: white;
  color: #1c1c1c;
  padding: 1rem;
  border-radius: 0.5rem;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .component {
    background: #27251f;
    color: #f5f5f4;
  }
}

/* Mobile */
@media (max-width: 768px) {
  .component {
    padding: 0.75rem;
  }
}
```

## Hook Pattern

All hooks follow this pattern for data fetching:

```typescript
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

export function useData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.data.get(id);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fetchData };
}
```

## API Integration

Use the `api` client from `lib/api-client.ts`:

```typescript
import { api } from '@/lib/api-client';

// Create profile
const profile = await api.profiles.create({
  name: 'Senior Engineer',
  category: 'Software Engineering',
  seniority: 'senior',
  skills: ['Node.js', 'TypeScript'],
  baseResume: '...',
});

// Submit JD
const session = await api.sessions.submitJD(sessionId, jdText);

// Answer cards
await api.sessions.answerCards(sessionId, [
  { cardId: 'card1', answer: 'yes' },
  { cardId: 'card2', answer: ['skill1', 'skill2'] },
]);
```

## State Management

Use React Context (`SessionContext`) for session-level state:

```typescript
import { useSessionContext } from '@/app/context/SessionContext';

export default function MyComponent() {
  const { currentSession, setCurrentSession, isLoading } = useSessionContext();

  const handleStartSession = async (profileId) => {
    const session = await api.sessions.create(profileId);
    setCurrentSession(session);
  };

  return (
    <div>
      {currentSession && <p>Session: {currentSession.id}</p>}
    </div>
  );
}
```

## Type Definitions

All types are exported from `lib/types.ts`. Use them throughout:

```typescript
import type { Session, Profile, Card, Decision } from '@/lib/types';

const session: Session = {
  id: '123',
  profileId: '456',
  state: 'waiting_skill_decisions',
  // ...
};
```

## Testing Pages

Open each page and verify:

1. **Landing Page** (`/`) — Hero, features, CTAs load correctly
2. **Profile Selector** (`/profile-selector`) — Profiles load and can be selected
3. **Create Profile** (`/create-profile`) — Form submits with validation
4. **JD Input** (`/jd-input`) — Text input with character counter
5. **Decision Board** (`/decision-board`) — Cards display and can be answered
6. **Strategy Review** (`/strategy-review`) — Strategy displays with match score
7. **Resume Preview** (`/resume-preview`) — Resume renders with match report
8. **Category Rejected** (`/category-rejected?profileCategory=...&jdCategory=...`) — Error state
9. **Session History** (`/session-history`) — Sessions list with filters

## Common Tasks

### Add a new page

1. Create `app/<page-name>/page.tsx`
2. Create `app/<page-name>/page.css`
3. Add export to navigation (Header.tsx)
4. Implement component with hooks

### Add a new UI component

1. Create `app/components/ui/ComponentName.tsx`
2. Create `app/components/ui/component-name.css`
3. Export from `app/components/ui/index.ts`
4. Use in pages: `import { ComponentName } from '@/app/components/ui'`

### Call the API

1. Use `api` client from `lib/api-client.ts`
2. Handle errors with try/catch
3. Set loading state during request
4. Display error messages to user

### Add dark mode support

1. Wrap styles in `@media (prefers-color-scheme: dark)` block
2. Test in both light and dark modes
3. Ensure contrast is legible in both

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then update values:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

## Debugging

### Check API calls

```typescript
// In browser console, with api client:
const profiles = await fetch('http://localhost:3001/api/v1/profiles').then(r => r.json());
console.log(profiles);
```

### View logs

```bash
# Terminal running `pnpm dev` will show all logs
```

### React DevTools

Use React DevTools browser extension to inspect state and props.

## Performance

- Pages are lazy-loaded via Next.js App Router
- UI components are small and focused
- API calls are wrapped with timeout (30s)
- Images use `next/image` where possible
- CSS is scoped to components

## Accessibility

All components include:
- Semantic HTML (`<button>`, `<form>`, etc.)
- Keyboard navigation (Tab, Enter, Escape)
- Focus states (visible outline)
- ARIA labels where needed
- Color contrast meets WCAG AA

## Next Steps

1. Start dev server: `pnpm dev`
2. Visit http://localhost:3000
3. Test the flow: home → profile selector → create profile → jd input → decisions → review → export
4. Check backend API is running on http://localhost:3001
5. Build more screens as needed

---

For architecture and design decisions, see `CLAUDE.md` in the root.
