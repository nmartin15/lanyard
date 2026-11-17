import type { MorningBrief } from './brief';
import { overnightRemoteUrl } from './overnightRemote';
import type { DialogueMessage, Huddle, Packet } from './types';

export type BriefDelivery = {
  status: 'sent' | 'queued' | 'skipped' | 'failed' | 'preview';
  path?: string | null;
  id?: string | null;
  error?: string | null;
};

export type BriefRemoteResult = {
  brief: MorningBrief;
  email: { to: string | null; subject: string };
  delivery: BriefDelivery;
};

/** POST board state to overnight-server /brief for email outbox or Resend. */
export async function postMorningBrief(
  input: {
    huddle: Huddle;
    packets: Packet[];
    dialogue: DialogueMessage[];
    to?: string | null;
    send?: boolean;
  },
  fetchImpl: typeof fetch = fetch
): Promise<BriefRemoteResult | null> {
  const base = overnightRemoteUrl();
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetchImpl(`${base}/brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        huddle: input.huddle,
        packets: input.packets,
        dialogue: input.dialogue,
        to: input.to ?? null,
        send: input.send !== false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as BriefRemoteResult;
    if (!json?.brief || !json?.delivery) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
