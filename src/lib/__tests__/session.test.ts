import AsyncStorage from '@react-native-async-storage/async-storage';

import { assembleTeam, emptyIntake } from '../assembleTeam';
import {
  LEGACY_PROFILE_KEY,
  STATE_KEY,
  clearPersistedState,
  emptyPersistedState,
  loadPersistedState,
  parsePersistedState,
  savePersistedState,
  stateFromProfile,
} from '../session';
import type { UserProfile } from '../types';

describe('parsePersistedState', () => {
  test('reads v1 state', () => {
    const state = emptyPersistedState();
    const parsed = parsePersistedState(JSON.stringify(state));
    expect(parsed?.version).toBe(1);
    expect(parsed?.draft).toEqual(state.draft);
  });

  test('migrates legacy profile shape', () => {
    const intake = {
      ...emptyIntake(),
      archetype: 'operator' as const,
      goals: 'build bench',
      antiGoals: 'no chaos',
    };
    const profile: UserProfile = {
      intakeComplete: true,
      intake,
      team: assembleTeam(intake),
      createdAt: 'a',
      updatedAt: 'b',
    };
    const parsed = parsePersistedState(JSON.stringify(profile));
    expect(parsed?.profile?.intake.goals).toBe('build bench');
    expect(parsed?.huddle.belief).toContain('build bench');
    expect(parsed?.packets).toHaveLength(2);
  });

  test('returns null for garbage', () => {
    expect(parsePersistedState('{')).toBeNull();
    expect(parsePersistedState('"nope"')).toBeNull();
  });
});

describe('load/save PersistedState', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('round-trips through AsyncStorage', async () => {
    const intake = { ...emptyIntake(), goals: 'raise', antiGoals: 'no spray' };
    const profile: UserProfile = {
      intakeComplete: true,
      intake,
      team: assembleTeam(intake),
      createdAt: '1',
      updatedAt: '2',
    };
    const state = stateFromProfile(profile);
    await savePersistedState(state);
    const loaded = await loadPersistedState();
    expect(loaded.profile?.intake.goals).toBe('raise');
    expect(loaded.packets[0].status).toBe('pending');
  });

  test('migrates legacy profile key once', async () => {
    const intake = { ...emptyIntake(), goals: 'legacy goals', antiGoals: 'x' };
    const profile: UserProfile = {
      intakeComplete: true,
      intake,
      team: assembleTeam(intake),
      createdAt: '1',
      updatedAt: '2',
    };
    await AsyncStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(profile));
    const loaded = await loadPersistedState();
    expect(loaded.profile?.intake.goals).toBe('legacy goals');
    expect(await AsyncStorage.getItem(STATE_KEY)).toBeTruthy();
    expect(await AsyncStorage.getItem(LEGACY_PROFILE_KEY)).toBeNull();
  });

  test('clear removes both keys', async () => {
    await savePersistedState(emptyPersistedState());
    await AsyncStorage.setItem(LEGACY_PROFILE_KEY, '{}');
    await clearPersistedState();
    expect(await AsyncStorage.getItem(STATE_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY_PROFILE_KEY)).toBeNull();
  });
});
