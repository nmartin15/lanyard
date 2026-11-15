import { buildReplyMessages, mergeHuddleQuestionsIntoDialogue } from '../dialogue';
import type { DialogueMessage, Huddle } from '../types';

const huddle = (questions: string[], updatedAt = 't1'): Huddle => ({
  belief: 'b',
  chasing: [],
  questions,
  filtered: [],
  updatedAt,
});

describe('dialogue helpers', () => {
  test('merges new huddle questions without duplicates', () => {
    const existing: DialogueMessage[] = [
      {
        id: '1',
        from: 'team',
        text: 'Still hold anti-goals?',
        createdAt: 'a',
      },
    ];
    const merged = mergeHuddleQuestionsIntoDialogue(
      existing,
      huddle(['Still hold anti-goals?', 'What shifted on hiring?'], 't2'),
      () => 'now'
    );
    expect(merged).toHaveLength(2);
    expect(merged[1].text).toBe('What shifted on hiring?');
    expect(merged[1].id).toContain('t2');
  });

  test('buildReplyMessages returns you + team ack', () => {
    const msgs = buildReplyMessages('no SaaS', () => 'now', () => 'd1');
    expect(msgs).toEqual([
      { id: 'd1', from: 'you', text: 'no SaaS', createdAt: 'now' },
      {
        id: 'd1-r',
        from: 'team',
        text: 'Logged. We’ll retarget hunts from that. Anything else to correct?',
        createdAt: 'now',
      },
    ]);
  });
});
