import {
  alternateSeats,
  assembleTeam,
  buildHuddle,
  buildStarterPackets,
  emptyIntake,
} from '../assembleTeam';
import type { IntakeDraft } from '../types';

function intake(patch: Partial<IntakeDraft> = {}): IntakeDraft {
  return { ...emptyIntake(), ...patch };
}

describe('assembleTeam', () => {
  test('casts entrepreneur/investor bench', () => {
    const team = assembleTeam(
      intake({ archetype: 'entrepreneur_investor', networkAltitude: 'building' })
    );
    expect(team.map((s) => s.role)).toEqual([
      'deal',
      'capital',
      'operators',
      'structure',
      'counsel',
    ]);
    expect(team[0].mandate).toContain('Building altitude');
  });

  test('casts corporate climber bench', () => {
    const team = assembleTeam(intake({ archetype: 'corporate_climber' }));
    expect(team.map((s) => s.title)).toEqual([
      'Sponsor map',
      'Visibility',
      'Skills',
      'Counsel',
    ]);
  });

  test('casts lean default for other', () => {
    const team = assembleTeam(intake({ archetype: 'other' }));
    expect(team).toHaveLength(3);
    expect(team.map((s) => s.role)).toEqual(['deal', 'capital', 'counsel']);
  });
});

describe('alternateSeats', () => {
  test('excludes seats already on the bench', () => {
    const team = assembleTeam(intake({ archetype: 'operator' }));
    const alts = alternateSeats(team);
    const keys = new Set(team.map((s) => `${s.role}:${s.title}`));
    for (const alt of alts) {
      expect(keys.has(`${alt.role}:${alt.title}`)).toBe(false);
    }
    expect(alts.some((s) => s.title === 'Deal lead')).toBe(true);
  });
});

describe('buildHuddle', () => {
  test('uses goals and anti-goals from intake', () => {
    const huddle = buildHuddle(
      intake({
        archetype: 'entrepreneur_investor',
        goals: 'hire one operator',
        antiGoals: 'no cold decks',
        respectList: 'Maya',
      }),
      () => '2026-01-01T00:00:00.000Z'
    );
    expect(huddle.belief).toContain('hire one operator');
    expect(huddle.questions.some((q) => q.includes('no cold decks'))).toBe(true);
    expect(huddle.filtered.some((f) => f.includes('respect list') || f.includes('Maya'))).toBe(
      true
    );
    expect(huddle.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('buildStarterPackets', () => {
  test('creates pending packets oriented to intake', () => {
    const packets = buildStarterPackets(
      intake({
        goals: 'two angel checks',
        antiGoals: 'no spam optics',
        respectList: 'Northbridge mutuals',
        neverMessageAsMe: true,
      }),
      () => 42
    );
    expect(packets).toHaveLength(2);
    expect(packets.every((p) => p.status === 'pending')).toBe(true);
    expect(packets[0].id).toBe('p-42-1');
    expect(packets[0].who).toContain('Northbridge mutuals');
    expect(packets[1].risk).toContain('no spam optics');
  });
});
