import { emptyIntake } from '../assembleTeam';
import { suggestVoiceFromIntake } from '../suggestVoice';

describe('suggestVoiceFromIntake', () => {
  test('drafts corpus + respect from goals and anti-goals', () => {
    const draft = suggestVoiceFromIntake({
      ...emptyIntake(),
      archetype: 'entrepreneur_investor',
      networkAltitude: 'building',
      goals: 'Land 2 paid AI consults and warm investor chats',
      antiGoals: 'No service businesses. No pitches',
    });

    expect(draft.corpusNote).toContain('Land 2 paid AI consults');
    expect(draft.corpusNote).toContain('No service businesses');
    expect(draft.corpusNote).toContain('Warm intros');
    expect(draft.respectList).toContain('angels');
    expect(draft.respectList.toLowerCase()).toContain('never');
  });

  test('still returns usable copy with sparse intake', () => {
    const draft = suggestVoiceFromIntake({
      ...emptyIntake(),
      archetype: 'operator',
      networkAltitude: null,
      goals: '',
      antiGoals: '',
    });
    expect(draft.corpusNote.length).toBeGreaterThan(20);
    expect(draft.respectList.length).toBeGreaterThan(10);
  });
});
