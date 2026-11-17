import { intakeBackHref, intakeStepIndex } from '../intakeFlow';

describe('intakeFlow', () => {
  test('indexes steps', () => {
    expect(intakeStepIndex('you')).toBe(0);
    expect(intakeStepIndex('team')).toBe(4);
  });

  test('back href walks the linear path', () => {
    expect(intakeBackHref('you')).toBe('/intake');
    expect(intakeBackHref('ambition')).toBe('/intake/archetype');
    expect(intakeBackHref('voice')).toBe('/intake/goals');
    expect(intakeBackHref('rules')).toBe('/intake/corpus');
    expect(intakeBackHref('team')).toBe('/intake/constraints');
  });
});
