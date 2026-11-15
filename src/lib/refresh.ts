import { mergeHuddleQuestionsIntoDialogue } from './dialogue';
import { isHuddleStale, type OvernightInput } from './overnight';
import { runOvernightHunt } from './overnightProvider';
import { mergePacketArchive } from './packets';
import type { PersistedState } from './session';

export function overnightInputFromState(state: PersistedState): OvernightInput {
  return {
    intake: state.profile?.intake ?? state.draft,
    team: state.profile?.team ?? [],
    packets: state.packets,
    corpus: state.corpus,
    packetArchive: state.packetArchive,
  };
}

export async function applyOvernightToState(
  state: PersistedState,
  now = () => new Date().toISOString(),
  idSeed = () => Date.now()
): Promise<PersistedState> {
  const archive = mergePacketArchive(state.packets, state.packetArchive);
  const { result } = await runOvernightHunt(overnightInputFromState(state), now, idSeed);
  const dialogue = mergeHuddleQuestionsIntoDialogue(state.dialogue, result.huddle);
  return {
    ...state,
    huddle: result.huddle,
    packets: result.packets,
    packetArchive: archive,
    dialogue,
  };
}

export async function refreshIfStale(
  state: PersistedState,
  nowMs = Date.now(),
  nowIso = () => new Date(nowMs).toISOString(),
  idSeed = () => nowMs
): Promise<{ state: PersistedState; didRefresh: boolean }> {
  if (!state.profile?.intakeComplete) return { state, didRefresh: false };
  if (!isHuddleStale(state.huddle, nowMs)) return { state, didRefresh: false };
  return {
    state: await applyOvernightToState(state, nowIso, idSeed),
    didRefresh: true,
  };
}
