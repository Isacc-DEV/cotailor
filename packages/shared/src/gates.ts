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

// Known subtype subsumption: JD subtype ⊃ profile subtype (Section 8.4).
const SUBSUMES: Record<string, string[]> = {
  'full stack engineer': ['backend engineer', 'frontend engineer'],
  'full-stack engineer': ['backend engineer', 'frontend engineer'],
};

export function subtypeRelation(profileSubtype: string, jdSubtype: string): SubtypeRelation {
  const p = norm(profileSubtype);
  const j = norm(jdSubtype);
  if (p === j) return 'same';
  if ((SUBSUMES[j] ?? []).includes(p)) return 'subsumes';
  const pWords = new Set(p.split(/\s+/));
  const shares = j.split(/\s+/).some((w) => w.length > 3 && pWords.has(w));
  return shares ? 'overlaps' : 'sibling';
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}
