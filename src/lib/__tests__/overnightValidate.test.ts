import { extractJsonObject, parseOvernightResult } from '../overnightValidate';

describe('overnightValidate', () => {
  test('parseOvernightResult accepts valid payload and forces pending', () => {
    const parsed = parseOvernightResult(
      {
        huddle: {
          belief: 'We hunted hire paths',
          chasing: ['Deal lead'],
          questions: ['Still true?'],
          filtered: ['Cold spray'],
          updatedAt: 'old',
        },
        packets: [
          {
            id: 'x',
            who: 'Warm candidate',
            why: 'fit',
            whyNow: 'now',
            risk: 'low',
            nextStep: 'intro',
            status: 'approve',
          },
        ],
      },
      () => 'stamp',
      () => 9
    );
    expect(parsed?.huddle.belief).toContain('hire');
    expect(parsed?.huddle.updatedAt).toBe('stamp');
    expect(parsed?.packets).toHaveLength(1);
    expect(parsed?.packets[0].status).toBe('pending');
  });

  test('parseOvernightResult rejects empty junk', () => {
    expect(parseOvernightResult(null)).toBeNull();
    expect(parseOvernightResult({ huddle: { belief: '' }, packets: [] })).toBeNull();
  });

  test('extractJsonObject pulls fenced object', () => {
    const raw = 'Here you go:\n{"huddle":{"belief":"ok"},"packets":[]}';
    expect(extractJsonObject(raw)).toEqual({ huddle: { belief: 'ok' }, packets: [] });
  });
});
