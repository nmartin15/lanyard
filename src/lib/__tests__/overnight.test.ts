import { emptyIntake } from '../assembleTeam';
import { isHuddleStale, simulateOvernight } from '../overnight';
import type { CorpusItem, IntakeDraft, Packet, TeamSeat } from '../types';

const team: TeamSeat[] = [
  { role: 'deal', title: 'Deal lead', mandate: 'Hunt fit' },
  { role: 'counsel', title: 'Counsel', mandate: 'Protect taste' },
];

function intake(patch: Partial<IntakeDraft> = {}): IntakeDraft {
  return {
    ...emptyIntake(),
    archetype: 'entrepreneur_investor',
    goals: 'one operator hire',
    antiGoals: 'no cold decks',
    respectList: 'ops peers',
    neverMessageAsMe: true,
    ...patch,
  };
}

describe('simulateOvernight', () => {
  test('carries pending, drops resolved, adds fresh packets', () => {
    const packets: Packet[] = [
      {
        id: 'keep',
        who: 'Pending warm path',
        why: 'y',
        whyNow: 'n',
        risk: 'r',
        nextStep: 's',
        status: 'pending',
      },
      {
        id: 'dead',
        who: 'Spam salon',
        why: 'y',
        whyNow: 'n',
        risk: 'r',
        nextStep: 's',
        status: 'kill',
      },
      {
        id: 'go',
        who: 'Maya intro',
        why: 'y',
        whyNow: 'n',
        risk: 'r',
        nextStep: 's',
        status: 'approve',
      },
    ];

    const result = simulateOvernight(
      { intake: intake(), team, packets, corpus: [] },
      () => '2026-02-01T08:00:00.000Z',
      () => 99
    );

    expect(result.packets.some((p) => p.id === 'keep')).toBe(true);
    expect(result.packets.every((p) => p.status === 'pending')).toBe(true);
    expect(result.packets.some((p) => p.id === 'dead' || p.id === 'go')).toBe(false);
    expect(result.packets.some((p) => p.id === 'p-99-s0')).toBe(true);
    expect(result.packets.some((p) => p.who.includes('Deal lead'))).toBe(true);
    expect(result.packets.some((p) => p.id === 'p-99-noise')).toBe(true);
    expect(result.huddle.updatedAt).toBe('2026-02-01T08:00:00.000Z');
    expect(result.huddle.belief).toContain('one operator hire');
    expect(result.huddle.belief).toContain('Deal lead');
    expect(result.huddle.chasing.some((c) => c.includes('Maya intro'))).toBe(true);
    expect(result.huddle.filtered.some((f) => f.includes('Spam salon'))).toBe(true);
    expect(result.huddle.filtered.some((f) => f.includes('message as you'))).toBe(true);
  });

  test('retargets from corpus corrections', () => {
    const corpus: CorpusItem[] = [
      {
        id: 'c1',
        kind: 'text',
        text: 'no SaaS tire-kickers',
        createdAt: '2026-02-01T07:00:00.000Z',
      },
      {
        id: 'c2',
        kind: 'voice',
        text: 'IC builder not manager',
        uri: 'file://x',
        durationMs: 2000,
        createdAt: '2026-02-01T07:30:00.000Z',
      },
    ];

    const result = simulateOvernight(
      {
        intake: intake(),
        team,
        packets: [
          {
            id: 'r1',
            who: 'Need reshape path',
            why: 'y',
            whyNow: 'n',
            risk: 'r',
            nextStep: 's',
            status: 'reshape',
          },
        ],
        corpus,
      },
      () => 't',
      () => 1
    );

    expect(result.huddle.belief).toContain('Corpus corrections');
    expect(result.huddle.questions.some((q) => q.includes('IC builder'))).toBe(true);
    expect(result.huddle.questions.some((q) => q.includes('Need reshape path'))).toBe(true);
    expect(result.packets.some((p) => p.whyNow?.includes('IC builder'))).toBe(true);
  });

  test('isHuddleStale after threshold', () => {
    const fresh = {
      belief: '',
      chasing: [],
      questions: [],
      filtered: [],
      updatedAt: new Date(1_700_000_000_000).toISOString(),
    };
    expect(isHuddleStale(fresh, 1_700_000_000_000 + 60_000)).toBe(false);
    expect(isHuddleStale(fresh, 1_700_000_000_000 + 9 * 60 * 60 * 1000)).toBe(true);
    expect(isHuddleStale({ ...fresh, updatedAt: 'bad' }, Date.now())).toBe(true);
  });
});
