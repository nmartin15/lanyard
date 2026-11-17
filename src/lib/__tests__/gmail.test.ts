import { fetchGmailStatus, sendOutreachEmail } from '../gmail';

describe('gmail client', () => {
  const prev = process.env.EXPO_PUBLIC_OVERNIGHT_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.EXPO_PUBLIC_OVERNIGHT_URL;
    else process.env.EXPO_PUBLIC_OVERNIGHT_URL = prev;
  });

  test('fetchGmailStatus explains missing server URL', async () => {
    delete process.env.EXPO_PUBLIC_OVERNIGHT_URL;
    const status = await fetchGmailStatus();
    expect(status.configured).toBe(false);
    expect(status.error).toMatch(/EXPO_PUBLIC_OVERNIGHT_URL/);
  });

  test('fetchGmailStatus reads server payload', async () => {
    process.env.EXPO_PUBLIC_OVERNIGHT_URL = 'http://mail.test';
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: true, connected: true, email: 'a@b.com' }),
    });
    const status = await fetchGmailStatus(fetchImpl as typeof fetch);
    expect(status.connected).toBe(true);
    expect(status.email).toBe('a@b.com');
    expect(fetchImpl).toHaveBeenCalled();
  });

  test('sendOutreachEmail posts to /outreach/send', async () => {
    process.env.EXPO_PUBLIC_OVERNIGHT_URL = 'http://mail.test';
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, id: 'm1', from: 'a@b.com', to: 'c@d.com' }),
    });
    const result = await sendOutreachEmail(
      { to: 'c@d.com', subject: 'Hi', body: 'Body' },
      fetchImpl as typeof fetch
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe('m1');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://mail.test/outreach/send',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
