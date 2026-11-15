import { emptyIntake } from '../assembleTeam';
import { applyOvernightToState, refreshIfStale } from '../refresh';
import { emptyPersistedState } from '../session';
import type { UserProfile } from '../types';

function completedState(updatedAt: string) {
  const intake = {
    ...emptyIntake(),
    archetype: 'entrepreneur_investor' as const,
    goals: 'hire',
    antiGoals: 'no spam',
  };
  const profile: UserProfile = {
    intakeComplete: true,
    intake,
    team: [
      { role: 'deal', title: 'Deal lead', mandate: 'Hunt' },
      { role: 'counsel', title: 'Counsel', mandate: 'Taste' },
    ],
    createdAt: 'a',
    updatedAt: 'b',
  };
  const base = emptyPersistedState();
  return {
    ...base,
    profile,
    draft: intake,
    huddle: { ...base.huddle, updatedAt },
    packets: [
      {
        id: 'old',
        who: 'Old kill',
        why: 'y',
        whyNow: 'n',
        risk: 'r',
        nextStep: 's',
        status: 'kill' as const,
      },
    ],
  };
}

describe('refresh helpers', () => {
  test('applyOvernightToState archives resolved and refreshes board', () => {
    const next = applyOvernightToState(
      completedState('2026-01-01T00:00:00.000Z'),
      () => '2026-01-02T00:00:00.000Z',
      () => 55
    );
    expect(next.packetArchive.some((p) => p.id === 'old')).toBe(true);
    expect(next.packets.every((p) => p.status === 'pending')).toBe(true);
    expect(next.huddle.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(next.huddle.belief).toContain('hire');
  });

  test('refreshIfStale only when intake complete and stale', () => {
    const fresh = completedState(new Date().toISOString());
    expect(refreshIfStale(fresh).didRefresh).toBe(false);

    const incomplete = emptyPersistedState();
    expect(refreshIfStale(incomplete).didRefresh).toBe(false);

    const staleAt = Date.now() - 10 * 60 * 60 * 1000;
    const stale = completedState(new Date(staleAt).toISOString());
    const result = refreshIfStale(stale, Date.now(), () => 'now', () => 1);
    expect(result.didRefresh).toBe(true);
    expect(result.state.huddle.updatedAt).toBe('now');
  });
});
