import * as SecureStore from 'expo-secure-store';

const KEY = 'lanyard.deviceId.v1';

function randomId(): string {
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable per-install id so the overnight server can store this phone’s Gmail tokens. */
export async function getDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing) return existing;
  } catch {
    // SecureStore can fail on some test hosts — fall through.
  }
  const next = randomId();
  try {
    await SecureStore.setItemAsync(KEY, next);
  } catch {
    // still return an id for this session
  }
  return next;
}
