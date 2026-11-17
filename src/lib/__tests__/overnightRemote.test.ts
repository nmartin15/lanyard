import { emptyIntake } from '../assembleTeam';
import { fetchOvernightRemote } from '../overnightRemote';

describe('fetchOvernightRemote', () => {
  const input = {
    intake: emptyIntake(),
    team: [],
    packets: [],
    corpus: [],
  };

  test('returns null when EXPO_PUBLIC_OVERNIGHT_URL is unset', async () => {
    const prev = process.env.EXPO_PUBLIC_OVERNIGHT_URL;
    delete process.env.EXPO_PUBLIC_OVERNIGHT_URL;
    await expect(fetchOvernightRemote(input)).resolves.toBeNull();
    if (prev !== undefined) process.env.EXPO_PUBLIC_OVERNIGHT_URL = prev;
  });

  test('parses successful remote JSON', async () => {
    process.env.EXPO_PUBLIC_OVERNIGHT_URL = 'http://overnight.test';
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        huddle: {
          belief: 'From API',
          chasing: ['c'],
          questions: ['q'],
          filtered: ['f'],
          updatedAt: 'x',
        },
        packets: [
          {
            id: '1',
            who: 'API who',
            why: 'y',
            whyNow: 'n',
            risk: 'r',
            nextStep: 's',
            status: 'pending',
          },
        ],
      }),
    });
    const result = await fetchOvernightRemote(input, () => 'now', () => 1, fetchImpl as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://overnight.test/overnight',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result?.huddle.belief).toBe('From API');
    expect(result?.packets[0].who).toBe('API who');
    delete process.env.EXPO_PUBLIC_OVERNIGHT_URL;
  });

  test('returns null on HTTP error', async () => {
    process.env.EXPO_PUBLIC_OVERNIGHT_URL = 'http://overnight.test';
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });
    await expect(
      fetchOvernightRemote(input, () => 'now', () => 1, fetchImpl as typeof fetch)
    ).resolves.toBeNull();
    delete process.env.EXPO_PUBLIC_OVERNIGHT_URL;
  });

  test('returns null when fetch throws / aborts', async () => {
    process.env.EXPO_PUBLIC_OVERNIGHT_URL = 'http://overnight.test';
    const fetchImpl = jest.fn().mockRejectedValue(new Error('aborted'));
    await expect(
      fetchOvernightRemote(input, () => 'now', () => 1, fetchImpl as typeof fetch)
    ).resolves.toBeNull();
    delete process.env.EXPO_PUBLIC_OVERNIGHT_URL;
  });

  test('returns null for malformed remote JSON', async () => {
    process.env.EXPO_PUBLIC_OVERNIGHT_URL = 'http://overnight.test';
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ not: 'overnight' }),
    });
    await expect(
      fetchOvernightRemote(input, () => 'now', () => 1, fetchImpl as typeof fetch)
    ).resolves.toBeNull();
    delete process.env.EXPO_PUBLIC_OVERNIGHT_URL;
  });
});
