import type { OvernightInput, OvernightResult } from './overnight';
import { parseOvernightResult } from './overnightValidate';

export function overnightRemoteUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_OVERNIGHT_URL?.trim();
  return url ? url.replace(/\/$/, '') : null;
}

export async function fetchOvernightRemote(
  input: OvernightInput,
  nowIso = () => new Date().toISOString(),
  idSeed = () => Date.now(),
  fetchImpl: typeof fetch = fetch
): Promise<OvernightResult | null> {
  const base = overnightRemoteUrl();
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetchImpl(`${base}/overnight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return parseOvernightResult(json, nowIso, idSeed);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
