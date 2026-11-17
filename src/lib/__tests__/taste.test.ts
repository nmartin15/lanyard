import { goalsLookThin, intakeLooksThin } from '../taste';

describe('taste helpers', () => {
  test('flags thin goals', () => {
    expect(goalsLookThin('raise', 'no')).toBe(true);
    expect(
      goalsLookThin(
        'Paid AI advisory for Series A fintech ops leaders in SF',
        'No cold spray, no services shops, no LinkedIn theater'
      )
    ).toBe(false);
  });

  test('flags thin overall intake', () => {
    expect(
      intakeLooksThin({
        goals: 'hire',
        antiGoals: 'spam',
        corpusNote: 'ok',
        respectList: '',
      })
    ).toBe(true);
  });
});
