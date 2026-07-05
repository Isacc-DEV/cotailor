// Where opening a session should land, given how far it got. Finished sessions
// open straight on their stored resume (like picking a past chat); everything
// else resumes at the step the session is waiting on.
export function routeForState(state: string, id: string): string {
  if (state === 'CREATED') return `/jd-input?sessionId=${id}`;
  if (
    [
      'JD_SUBMITTED',
      'ANALYZING',
      'WAITING_CATEGORY_CONFIRMATION',
      'WAITING_SUBTYPE_CONFIRMATION',
      'WAITING_SKILL_DECISIONS',
    ].includes(state)
  ) {
    return `/decision-board?sessionId=${id}`;
  }
  if (state === 'STRATEGY_REVIEW') return `/strategy-review?sessionId=${id}`;
  if (state === 'CATEGORY_REJECTED') return `/category-rejected?sessionId=${id}`;
  if (state === 'CANCELLED' || state === 'EXPIRED') return `/jd-input?sessionId=${id}`;
  // GENERATING / VALIDATING / NEEDS_REVISION / REVISING / FINAL_READY
  return `/resume-preview?sessionId=${id}`;
}
