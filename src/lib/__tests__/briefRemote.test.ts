import { postMorningBrief } from '../briefRemote';
import { packetFixture } from '../packets';
import type { DialogueMessage, Huddle, Packet } from '../types';

const huddle: Huddle = {
  belief: 'Warm paths only.',
  chasing: [],
  questions: [],
  filtered: [],
  updatedAt: 't',
};

const packets: Packet[] = [packetFixture({ id: 'p1', who: 'A', status: 'pending' })];

const dialogue: DialogueMessage[] = [];

describe('postMorningBrief', () => {
  const prev = process.env.EXPO_PUBLIC_OVERNIGHT_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.EXPO_PUBLIC_OVERNIGHT_URL;
    else process.env.EXPO_PUBLIC_OVERNIGHT_URL = prev;
  });

  test('returns null when overnight URL unset', async () => {
    delete process.env.EXPO_PUBLIC_OVERNIGHT_URL;
    expect(await postMorningBrief({ huddle, packets, dialogue })).toBeNull();
  });

  test('posts board state and returns delivery', async () => {
    process.env.EXPO_PUBLIC_OVERNIGHT_URL = 'http://brief.test';
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        brief: {
          id: 'b1',
          generatedAt: 't',
          subject: 'Lanyard · test',
          skim: { belief: 'Warm paths only.', pendingCount: 1, questionCount: 0 },
          narrative: 'n',
          chasing: [],
          filtered: [],
          questions: [],
          packets: [],
          actions: {
            openHuddle: 'lanyard://huddle',
            openPackets: 'lanyard://packets',
            openTalk: 'lanyard://talk',
            openBrief: 'lanyard://brief',
          },
        },
        email: { to: 'a@b.c', subject: 'Lanyard · test' },
        delivery: { status: 'queued', path: '/tmp/out.json' },
      }),
    })) as unknown as typeof fetch;

    const result = await postMorningBrief(
      { huddle, packets, dialogue, to: 'a@b.c' },
      fetchImpl
    );
    expect(result?.delivery.status).toBe('queued');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://brief.test/brief',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
