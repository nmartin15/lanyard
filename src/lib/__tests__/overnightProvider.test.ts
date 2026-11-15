import { emptyIntake } from '../assembleTeam';
import { runOvernightHunt } from '../overnightProvider';
import * as remote from '../overnightRemote';

const input = {
  intake: {
    ...emptyIntake(),
    goals: 'hire an operator',
    antiGoals: 'no spam',
  },
  team: [{ role: 'deal' as const, title: 'Deal lead', mandate: 'Hunt' }],
  packets: [],
  corpus: [],
};

describe('runOvernightHunt', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses remote when it returns a result', async () => {
    jest.spyOn(remote, 'fetchOvernightRemote').mockResolvedValue({
      huddle: {
        belief: 'Remote hunt',
        chasing: ['a'],
        questions: ['q'],
        filtered: ['f'],
        updatedAt: 't',
      },
      packets: [
        {
          id: 'r1',
          who: 'Remote who',
          why: 'y',
          whyNow: 'n',
          risk: 'r',
          nextStep: 's',
          status: 'pending',
        },
      ],
    });
    const run = await runOvernightHunt(input, () => 'now', () => 1);
    expect(run.source).toBe('remote');
    expect(run.result.huddle.belief).toBe('Remote hunt');
  });

  test('falls back to local simulation', async () => {
    jest.spyOn(remote, 'fetchOvernightRemote').mockResolvedValue(null);
    const run = await runOvernightHunt(input, () => 'now', () => 1);
    expect(run.source).toBe('local');
    expect(run.result.packets.length).toBeGreaterThan(0);
    expect(run.result.huddle.belief).toContain('hire an operator');
  });
});
