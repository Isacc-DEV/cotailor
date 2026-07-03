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

  // Knockouts satisfiable from the profile auto-resolve; the rest need explicit confirmation.
  unresolvedKnockouts(profile: { workAuthorization: string | null }, ex: SkillExtraction) {
    return ex.knockout_requirements.filter((k) => {
      if (k.type === 'work_authorization') return !profile.workAuthorization;
      return true;
    });
  }
}
