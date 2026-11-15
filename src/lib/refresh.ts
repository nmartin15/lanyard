import { mergeHuddleQuestionsIntoDialogue } from './dialogue';
import { isHuddleStale, simulateOvernight } from './overnight';
import { mergePacketArchive } from './packets';
import type { PersistedState } from './session';

export function applyOvernightToState(
  state: PersistedState,
  now = () => new Date().toISOString(),
  idSeed = () => Date.now()
): PersistedState {
  const intake = state.profile?.intake ?? state.draft;
  const team = state.profile?.team ?? [];
  const archive = mergePacketArchive(state.packets, state.packetArchive);
  const result = simulateOvernight(
    {
      intake,
      team,
      packets: state.packets,
      corpus: state.corpus,
      packetArchive: state.packetArchive,
    },
    now,
    idSeed
  );
  const dialogue = mergeHuddleQuestionsIntoDialogue(state.dialogue, result.huddle);
  return {
    ...state,
    huddle: result.huddle,
    packets: result.packets,
    packetArchive: archive,
    dialogue,
  };
}

export function refreshIfStale(
  state: PersistedState,
  nowMs = Date.now(),
  nowIso = () => new Date(nowMs).toISOString(),
  idSeed = () => nowMs
): { state: PersistedState; didRefresh: boolean } {
  if (!state.profile?.intakeComplete) return { state, didRefresh: false };
  if (!isHuddleStale(state.huddle, nowMs)) return { state, didRefresh: false };
  return { state: applyOvernightToState(state, nowIso, idSeed), didRefresh: true };
}
