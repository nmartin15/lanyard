import type { IntakeDraft } from './types';

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Short intake is common — overnight hunts worse without color. */
export function intakeLooksThin(
  intake: Pick<IntakeDraft, 'goals' | 'antiGoals' | 'corpusNote' | 'respectList'>
): boolean {
  return (
    wordCount(intake.goals) < 10 ||
    wordCount(intake.antiGoals) < 5 ||
    wordCount(intake.corpusNote) < 12
  );
}

export function goalsLookThin(goals: string, antiGoals: string): boolean {
  return wordCount(goals) < 10 || wordCount(antiGoals) < 5;
}

export const TASTE_LOOP_LINES = [
  'Approve or pass in Decisions — that teaches what “good” looks like.',
  'Answer in Questions — that steers the next overnight hunt.',
  'Send a Reply — quick corrections land in your taste file.',
] as const;

export const CORPUS_BUILD_LINES = [
  'Intake (goals, hard no’s, how winning looks)',
  'Every Yes / No / Tweak on a lead',
  'Answers you type in Questions',
  'Replies and voice notes you send',
  'Files you attach',
] as const;
