import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildHuddle, buildStarterPackets, emptyIntake } from './assembleTeam';
import { normalizePackets } from './packets';
import type {
  CorpusItem,
  DialogueMessage,
  Huddle,
  IntakeDraft,
  Packet,
  UserProfile,
} from './types';

export const STATE_KEY = 'lanyard.state.v1';
export const LEGACY_PROFILE_KEY = 'lanyard.profile.v1';

export type PersistedState = {
  version: 1;
  profile: UserProfile | null;
  draft: IntakeDraft;
  huddle: Huddle;
  packets: Packet[];
  packetArchive: Packet[];
  corpus: CorpusItem[];
  dialogue: DialogueMessage[];
};

export function emptyPersistedState(): PersistedState {
  const draft = emptyIntake();
  return {
    version: 1,
    profile: null,
    draft,
    huddle: buildHuddle(draft),
    packets: buildStarterPackets(draft),
    packetArchive: [],
    corpus: [],
    dialogue: [],
  };
}

export function stateFromProfile(profile: UserProfile): PersistedState {
  return {
    version: 1,
    profile,
    draft: profile.intake,
    huddle: buildHuddle(profile.intake),
    packets: buildStarterPackets(profile.intake),
    packetArchive: [],
    corpus: [],
    dialogue: [],
  };
}

function normalizeIntake(draft: IntakeDraft): IntakeDraft {
  const mail =
    draft.mailProvider === 'gmail' || draft.mailProvider === 'microsoft'
      ? draft.mailProvider
      : 'none';
  return {
    ...emptyIntake(),
    ...draft,
    notifyEmail: typeof draft.notifyEmail === 'string' ? draft.notifyEmail : '',
    mailProvider: mail,
  };
}

export function normalizePersistedState(state: PersistedState): PersistedState {
  const draft = normalizeIntake(state.draft);
  const profile = state.profile
    ? { ...state.profile, intake: normalizeIntake(state.profile.intake) }
    : null;
  const packets = normalizePackets(Array.isArray(state.packets) ? state.packets : []);
  const packetArchive = normalizePackets(
    Array.isArray(state.packetArchive) ? state.packetArchive : []
  );
  return {
    ...state,
    draft,
    profile,
    packets,
    packetArchive,
    corpus: Array.isArray(state.corpus) ? state.corpus : [],
    dialogue: Array.isArray(state.dialogue) ? state.dialogue : [],
  };
}

export function parsePersistedState(raw: string): PersistedState | null {
  try {
    const parsed = JSON.parse(raw) as PersistedState | UserProfile;
    if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === 1) {
      return normalizePersistedState(parsed as PersistedState);
    }
    if (parsed && typeof parsed === 'object' && 'intakeComplete' in parsed) {
      return stateFromProfile(parsed as UserProfile);
    }
  } catch {
    return null;
  }
  return null;
}

export async function loadPersistedState(): Promise<PersistedState> {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (raw) {
    const parsed = parsePersistedState(raw);
    if (parsed) return parsed;
  }

  const legacy = await AsyncStorage.getItem(LEGACY_PROFILE_KEY);
  if (legacy) {
    const parsed = parsePersistedState(legacy);
    if (parsed) {
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify(parsed));
      await AsyncStorage.removeItem(LEGACY_PROFILE_KEY);
      return parsed;
    }
  }

  return emptyPersistedState();
}

export async function savePersistedState(state: PersistedState): Promise<void> {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export async function clearPersistedState(): Promise<void> {
  await AsyncStorage.multiRemove([STATE_KEY, LEGACY_PROFILE_KEY]);
}
