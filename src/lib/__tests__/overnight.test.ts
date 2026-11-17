import { emptyIntake } from '../assembleTeam';
import { isHuddleStale, simulateOvernight } from '../overnight';
import { packetFixture } from '../packets';
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
      packetFixture({ id: 'keep', who: 'Pending warm path', status: 'pending' }),
      packetFixture({ id: 'dead', who: 'Spam salon', status: 'kill' }),
      packetFixture({ id: 'go', who: 'Maya intro', status: 'approve' }),
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
    expect(result.huddle.filtered.some((f) => f.includes('pretend to be you'))).toBe(true);
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
        packets: [packetFixture({ id: 'r1', who: 'Need reshape path', status: 'reshape' })],
        corpus,
      },
      () => 't',
      () => 1
    );

    expect(result.huddle.belief).toContain('Your notes landed');
    expect(result.huddle.questions.some((q) => q.includes('IC builder'))).toBe(true);
    expect(result.huddle.questions.some((q) => q.includes('Need reshape path'))).toBe(true);
    expect(result.packets.some((p) => p.whyNow?.includes('IC builder'))).toBe(true);
  });

  test('network altitude appears in belief and chasing', () => {
    const result = simulateOvernight(
      {
        intake: intake({ networkAltitude: 'selective' }),
        team,
        packets: [],
        corpus: [],
      },
      () => 't',
      () => 3
    );
    expect(result.huddle.belief).toContain('picky');
    expect(result.huddle.chasing.some((c) => c.includes('picky'))).toBe(true);
  });

  test('rare interrupt policy keeps a leaner board than normal', () => {
    const rare = simulateOvernight(
      {
        intake: intake({ interruptPolicy: 'rare' }),
        team,
        packets: [],
        corpus: [],
      },
      () => 't',
      () => 1
    );
    const normal = simulateOvernight(
      {
        intake: intake({ interruptPolicy: 'normal' }),
        team: [
          ...team,
          { role: 'capital', title: 'Capital', mandate: 'LP paths' },
          { role: 'operators', title: 'Operators', mandate: 'Hires' },
        ],
        packets: [],
        corpus: [],
      },
      () => 't',
      () => 2
    );
    expect(rare.packets.length).toBeLessThanOrEqual(3);
    expect(rare.huddle.belief).toContain('Quiet mode');
    expect(normal.packets.length).toBeGreaterThan(rare.packets.length);
    expect(normal.huddle.belief).toContain('Chatty mode');
  });

  test('filtered includes kills from packet archive', () => {
    const result = simulateOvernight(
      {
        intake: intake(),
        team,
        packets: [],
        corpus: [],
        packetArchive: [
          packetFixture({ id: 'arch1', who: 'Archived spray', status: 'kill' }),
        ],
      },
      () => 't',
      () => 7
    );
    expect(result.huddle.filtered.some((f) => f.includes('Archived spray'))).toBe(true);
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
