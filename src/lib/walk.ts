import type { Huddle, IntakeDraft } from './types';

/** One ambient prompt for Walk — prefer overnight questions, else anti-goals. */
export function pickWalkPrompt(huddle: Huddle, intake: IntakeDraft): string {
  const question = huddle.questions.find((q) => q.trim().length > 0);
  if (question) return question.trim();

  const anti = intake.antiGoals.trim();
  if (anti) {
    return `Quick check: still holding anti-goals — “${anti}” — or did that change?`;
  }
  return 'Quick check: what should we never do on your behalf this week?';
}
