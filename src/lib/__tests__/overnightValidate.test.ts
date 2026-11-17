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
    expect(parsed?.packets[0].research.length).toBeGreaterThan(0);
    expect(parsed?.packets[0].outreach.subject.length).toBeGreaterThan(0);
  });

  test('parseOvernightResult keeps research + outreach when provided', () => {
    const parsed = parseOvernightResult(
      {
        huddle: { belief: 'ok', chasing: [], questions: [], filtered: [] },
        packets: [
          {
            who: 'Operator X',
            why: 'fit',
            whyNow: 'now',
            risk: 'low',
            nextStep: 'send',
            sourceHint: 'ecosystem A',
            research: 'Deep research note',
            approach: 'Warm note',
            outreach: { to: 'x@y.com', subject: 'Hello', body: 'Body text' },
            status: 'pending',
          },
        ],
      },
      () => 'stamp',
      () => 3
    );
    expect(parsed?.packets[0].sourceHint).toBe('ecosystem A');
    expect(parsed?.packets[0].research).toBe('Deep research note');
    expect(parsed?.packets[0].outreach).toEqual({
      to: 'x@y.com',
      subject: 'Hello',
      body: 'Body text',
    });
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
