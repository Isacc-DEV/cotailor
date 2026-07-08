// Pure gate helpers (design Section 8). No I/O — unit-testable in isolation.
import { type SubtypeRelation } from './enums';

// Starter category taxonomy — a maintained list, never LLM-invented (Section 8.7).
export const CATEGORY_TAXONOMY = [
  'Software Engineering',
  'Data Science',
  'Data Engineering',
  'DevOps/SRE',
  'QA',
  'Product Management',
  'Design',
  'Marketing',
  'Sales',
  'Finance/Accounting',
  'Healthcare',
  'Civil/Mechanical Engineering',
] as const;

// Category adjacency ships OFF by default (Section 8.3): same string → same, else distinct.
export function categoryRelation(profileCategory: string, jdCategory: string): 'same' | 'distinct' {
  return norm(profileCategory) === norm(jdCategory) ? 'same' : 'distinct';
}

// Role-noun suffixes that don't change the discipline: "Backend Engineer",
// "Backend Developer" and "backendengineer" all mean "backend". Longest-first
// so "engineering" is stripped before the shorter "engineer" can partial-match.
const ROLE_NOUNS = [
  'engineering',
  'engineer',
  'developer',
  'programmer',
  'specialist',
  'architect',
  'dev',
];

// Collapse a subtype to a comparable key: lowercase, drop every separator (so
// "full stack", "full-stack" and "fullstack" agree) and strip one trailing role
// noun. "Backend" / "Backend Engineer" / "backendengineer" all → "backend".
function canonSubtype(s: string): string {
  let x = s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  for (const noun of ROLE_NOUNS) {
    if (x.length > noun.length && x.endsWith(noun)) {
      x = x.slice(0, -noun.length);
      break;
    }
  }
  return x;
}

// Broad subtypes and the narrower ones they fully contain (Section 8.4).
// A Full Stack engineer does both backend and frontend work.
const CONTAINS: Record<string, string[]> = {
  fullstack: ['backend', 'frontend'],
};

// Any shared meaningful word (role nouns excluded) → the subtypes at least overlap.
function sharesWord(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3 && !ROLE_NOUNS.includes(w)),
    );
  const wa = words(a);
  return [...words(b)].some((w) => wa.has(w));
}

export function subtypeRelation(profileSubtype: string, jdSubtype: string): SubtypeRelation {
  const p = canonSubtype(profileSubtype);
  const j = canonSubtype(jdSubtype);
  if (!p || !j) return 'same'; // one side unknown → don't raise a soft gate on noise
  if (p === j) return 'same'; // same discipline, modulo "engineer"/"developer" phrasing
  if ((CONTAINS[p] ?? []).includes(j)) return 'same'; // profile is broader and fully covers the JD
  if ((CONTAINS[j] ?? []).includes(p)) return 'subsumes'; // JD is broader — soft warning, proceed is fine
  return sharesWord(profileSubtype, jdSubtype) ? 'overlaps' : 'sibling';
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}
