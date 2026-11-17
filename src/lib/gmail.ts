import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getDeviceId } from './deviceId';
import { overnightRemoteUrl } from './overnightRemote';

WebBrowser.maybeCompleteAuthSession();

export type GmailStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  serverUrl: string | null;
  error?: string | null;
};

export type GmailSendResult =
  | { ok: true; id: string | null; from: string | null; to: string }
  | { ok: false; error: string; code?: string };

export async function fetchGmailStatus(
  fetchImpl: typeof fetch = fetch
): Promise<GmailStatus> {
  const serverUrl = overnightRemoteUrl();
  if (!serverUrl) {
    return {
      configured: false,
      connected: false,
      email: null,
      serverUrl: null,
      error: 'Set EXPO_PUBLIC_OVERNIGHT_URL so the phone can reach your Mac’s overnight server.',
    };
  }
  try {
    const deviceId = await getDeviceId();
    const res = await fetchImpl(
      `${serverUrl}/oauth/google/status?deviceId=${encodeURIComponent(deviceId)}`
    );
    if (!res.ok) {
      return {
        configured: false,
        connected: false,
        email: null,
        serverUrl,
        error: `Server status ${res.status}`,
      };
    }
    const json = (await res.json()) as {
      configured?: boolean;
      connected?: boolean;
      email?: string | null;
    };
    return {
      configured: Boolean(json.configured),
      connected: Boolean(json.connected),
      email: json.email ?? null,
      serverUrl,
      error: null,
    };
  } catch {
    return {
      configured: false,
      connected: false,
      email: null,
      serverUrl,
      error: 'Could not reach the overnight server. Is it running on your Mac?',
    };
  }
}

/**
 * Opens Google sign-in in a browser, then returns to Lanyard.
 * Requires overnight server with GOOGLE_* env vars.
 */
export async function connectGmail(
  fetchImpl: typeof fetch = fetch
): Promise<GmailStatus> {
  const serverUrl = overnightRemoteUrl();
  if (!serverUrl) {
    return fetchGmailStatus(fetchImpl);
  }

  const pre = await fetchGmailStatus(fetchImpl);
  if (!pre.configured) {
    return {
      ...pre,
      error:
        pre.error ||
        'Gmail isn’t set up on the server yet. Finish docs/CONNECT_GMAIL.md on your computer first.',
    };
  }

  const deviceId = await getDeviceId();
  const appRedirect = Linking.createURL('oauth/gmail');
  const startUrl = `${serverUrl}/oauth/google/start?deviceId=${encodeURIComponent(
    deviceId
  )}&appRedirect=${encodeURIComponent(appRedirect)}`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, appRedirect);
  if (result.type !== 'success') {
    return {
      ...pre,
      error: result.type === 'cancel' ? 'Connect canceled.' : 'Connect did not finish.',
    };
  }

  // Give the server a beat to finish token write, then re-check.
  await new Promise((r) => setTimeout(r, 400));
  const status = await fetchGmailStatus(fetchImpl);
  if (!status.connected) {
    return {
      ...status,
      error: status.error || 'Signed in, but Gmail still isn’t connected. Try again.',
    };
  }
  return status;
}

export async function disconnectGmail(
  fetchImpl: typeof fetch = fetch
): Promise<GmailStatus> {
  const serverUrl = overnightRemoteUrl();
  if (!serverUrl) return fetchGmailStatus(fetchImpl);
  const deviceId = await getDeviceId();
  try {
    await fetchImpl(`${serverUrl}/oauth/google?deviceId=${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
  } catch {
    // still return status
  }
  return fetchGmailStatus(fetchImpl);
}

/** Send approved outreach from the connected Gmail account via Gmail API. */
export async function sendOutreachEmail(
  input: { to: string; subject: string; body: string },
  fetchImpl: typeof fetch = fetch
): Promise<GmailSendResult> {
  const serverUrl = overnightRemoteUrl();
  if (!serverUrl) {
    return {
      ok: false,
      error: 'Overnight server URL is not set.',
      code: 'NO_SERVER',
    };
  }
  const deviceId = await getDeviceId();
  try {
    const res = await fetchImpl(`${serverUrl}/outreach/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        deviceId,
        to: input.to,
        subject: input.subject,
        body: input.body,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      id?: string | null;
      from?: string | null;
      to?: string;
      error?: string;
      code?: string;
    };
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        error: json.error || `Send failed (${res.status})`,
        code: json.code,
      };
    }
    return {
      ok: true,
      id: json.id ?? null,
      from: json.from ?? null,
      to: json.to || input.to,
    };
  } catch {
    return {
      ok: false,
      error: 'Could not reach the overnight server to send.',
      code: 'NETWORK',
    };
  }
}
