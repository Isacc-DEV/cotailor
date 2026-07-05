import { Injectable } from '@nestjs/common';
import {
  CATEGORY_CONFIDENCE_THRESHOLD,
  categoryRelation,
  subtypeRelation,
  type JdAnalysis,
  type SkillExtraction,
  type SubtypeRelation,
} from '@cotailor/shared';

export type CategoryOutcome =
  | { kind: 'match' }
  | { kind: 'low_confidence'; detected: string; confidence: number }
  | { kind: 'reject'; profileCategory: string; detected: string; confidence: number };

// Pure gate evaluation (design Section 8). No I/O — decisions only; the caller
// creates cards and drives state transitions.
@Injectable()
export class GatesService {
  evaluateCategory(profileCategory: string, category: string, confidence: number): CategoryOutcome {
    if (confidence < CATEGORY_CONFIDENCE_THRESHOLD) {
      return { kind: 'low_confidence', detected: category, confidence };
    }
    if (categoryRelation(profileCategory, category) === 'distinct') {
      return { kind: 'reject', profileCategory, detected: category, confidence };
    }
    return { kind: 'match' };
  }

  evaluateSubtype(profileSubtype: string, a: JdAnalysis): { relation: SubtypeRelation; mismatch: boolean } {
    const relation = subtypeRelation(profileSubtype || '', a.subtype);
    return { relation, mismatch: relation !== 'same' };
  }

  // Only these count as real hard gates worth a card. Anything else the model
  // may have tagged as a "knockout" (remote work, personal equipment, meeting
  // availability, years of experience) is noise and is dropped.
  private static readonly HARD_KNOCKOUT_TYPES = new Set([
    'work_authorization',
    'clearance',
    'security_clearance',
    'license',
    'degree',
    'education',
    'location',
    'onsite',
  ]);

  // Knockouts satisfiable from the profile auto-resolve; the rest need explicit confirmation.
  unresolvedKnockouts(profile: { workAuthorization: string | null }, ex: SkillExtraction) {
    return (ex.knockout_requirements ?? []).filter((k) => {
      const type = (k.type ?? '').toLowerCase();
      if (!GatesService.HARD_KNOCKOUT_TYPES.has(type)) return false; // drop logistics/soft noise
      if (type === 'work_authorization') return !profile.workAuthorization;
      return true;
    });
  }
}
