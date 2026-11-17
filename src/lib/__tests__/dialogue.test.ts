import {
  buildReplyMessages,
  buildVoiceReplyMessages,
  mergeHuddleQuestionsIntoDialogue,
  unansweredTeamPrompts,
} from '../dialogue';
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
        text: 'Got it — we’ll work differently from that. Anything else?',
        createdAt: 'now',
      },
    ]);
  });

  test('buildVoiceReplyMessages labels the voice turn', () => {
    const msgs = buildVoiceReplyMessages('hold anti-goals', () => 'now', () => 'v1');
    expect(msgs[0]).toEqual({
      id: 'v1',
      from: 'you',
      text: 'Voice: hold anti-goals',
      createdAt: 'now',
    });
    expect(msgs[1].text).toContain('Voice note saved');
  });

  test('unansweredTeamPrompts counts trailing team messages', () => {
    const thread: DialogueMessage[] = [
      { id: '1', from: 'team', text: 'q1', createdAt: 'a' },
      { id: '2', from: 'you', text: 'answer', createdAt: 'b' },
      { id: '3', from: 'team', text: 'ack', createdAt: 'c' },
      { id: '4', from: 'team', text: 'q2', createdAt: 'd' },
    ];
    expect(unansweredTeamPrompts(thread)).toBe(2);
    expect(unansweredTeamPrompts(thread.slice(0, 2))).toBe(0);
  });
});
