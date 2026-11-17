import { emptyIntake } from '../assembleTeam';
import { pickWalkPrompt } from '../walk';
import type { Huddle } from '../types';

const huddle = (questions: string[]): Huddle => ({
  belief: 'b',
  chasing: [],
  questions,
  filtered: [],
  updatedAt: 't',
});

describe('pickWalkPrompt', () => {
  test('prefers first huddle question', () => {
    expect(
      pickWalkPrompt(huddle(['Still hold no SaaS?', 'Other']), emptyIntake())
    ).toBe('Still hold no SaaS?');
  });

  test('falls back to anti-goals', () => {
    const intake = { ...emptyIntake(), antiGoals: 'no cold decks' };
    expect(pickWalkPrompt(huddle([]), intake)).toContain('no cold decks');
  });

  test('falls back to generic prompt', () => {
    expect(pickWalkPrompt(huddle(['  ']), emptyIntake())).toContain('hard no');
  });
});
