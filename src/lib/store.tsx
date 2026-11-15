import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { assembleTeam, buildHuddle, buildStarterPackets, emptyIntake } from './assembleTeam';
import { createCorpusItem, mergeCorpusNote } from './corpus';
import { buildReplyMessages, mergeHuddleQuestionsIntoDialogue } from './dialogue';
import { isHuddleStale, simulateOvernight } from './overnight';
import {
  clearPersistedState,
  emptyPersistedState,
  loadPersistedState,
  savePersistedState,
  type PersistedState,
} from './session';
import type {
  CorpusItem,
  DialogueMessage,
  Huddle,
  IntakeDraft,
  Packet,
  TeamSeat,
  UserProfile,
} from './types';

type Store = {
  ready: boolean;
  profile: UserProfile;
  huddle: Huddle;
  packets: Packet[];
  corpus: CorpusItem[];
  dialogue: DialogueMessage[];
  updateIntake: (patch: Partial<IntakeDraft>) => Promise<void>;
  completeIntake: () => Promise<void>;
  recastSeat: (index: number, seat: TeamSeat) => Promise<void>;
  resetAll: () => Promise<void>;
  resolvePacket: (id: string, status: Packet['status']) => Promise<void>;
  appendCorpusNote: (note: string) => Promise<void>;
  appendCorpusItem: (
    input: Omit<CorpusItem, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
  ) => Promise<CorpusItem>;
  runOvernight: () => Promise<void>;
  ensureOvernightIfStale: () => Promise<boolean>;
  sendDialogue: (text: string) => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

function newProfile(intake: IntakeDraft): UserProfile {
  const now = new Date().toISOString();
  return {
    intakeComplete: true,
    intake,
    team: assembleTeam(intake),
    createdAt: now,
    updatedAt: now,
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<UserProfile | null>(null);
  const [draft, setDraft] = useState<IntakeDraft>(emptyIntake());
  const [huddle, setHuddle] = useState<Huddle>(() => buildHuddle(emptyIntake()));
  const [packets, setPackets] = useState<Packet[]>(() => buildStarterPackets(emptyIntake()));
  const [corpus, setCorpus] = useState<CorpusItem[]>([]);
  const [dialogue, setDialogue] = useState<DialogueMessage[]>([]);
  const stateRef = useRef<PersistedState>(emptyPersistedState());
  const writeChain = useRef(Promise.resolve());
  const epochRef = useRef(0);

  const enqueueWrite = useCallback((op: () => Promise<void>) => {
    const run = writeChain.current.then(op, op);
    writeChain.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }, []);

  const flush = useCallback(
    async (next: PersistedState) => {
      const epoch = epochRef.current;
      stateRef.current = next;
      await enqueueWrite(async () => {
        if (epoch !== epochRef.current) return;
        await savePersistedState(stateRef.current);
      });
    },
    [enqueueWrite]
  );

  useEffect(() => {
    (async () => {
      try {
        const loaded = await loadPersistedState();
        stateRef.current = loaded;
        setSaved(loaded.profile);
        setDraft(loaded.draft);
        setHuddle(loaded.huddle);
        setPackets(loaded.packets);
        setCorpus(loaded.corpus);
        setDialogue(loaded.dialogue);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const updateIntake = useCallback(
    async (patch: Partial<IntakeDraft>) => {
      const nextDraft = { ...stateRef.current.draft, ...patch };
      const next: PersistedState = {
        ...stateRef.current,
        draft: nextDraft,
        profile: stateRef.current.profile,
      };
      setDraft(nextDraft);
      await flush(next);
    },
    [flush]
  );

  const completeIntake = useCallback(async () => {
    const intake = stateRef.current.draft;
    const profile = newProfile(intake);
    const nextHuddle = buildHuddle(intake);
    const nextPackets = buildStarterPackets(intake);
    const nextDialogue = mergeHuddleQuestionsIntoDialogue([], nextHuddle);
    const next: PersistedState = {
      version: 1,
      profile,
      draft: intake,
      huddle: nextHuddle,
      packets: nextPackets,
      corpus: stateRef.current.corpus,
      dialogue: nextDialogue,
    };
    setSaved(profile);
    setDraft(intake);
    setHuddle(nextHuddle);
    setPackets(nextPackets);
    setDialogue(nextDialogue);
    await flush(next);
  }, [flush]);

  const recastSeat = useCallback(
    async (index: number, seat: TeamSeat) => {
      const current = stateRef.current.profile;
      if (!current) return;
      const team = current.team.map((s, i) => (i === index ? seat : s));
      const profile: UserProfile = {
        ...current,
        team,
        updatedAt: new Date().toISOString(),
      };
      const next: PersistedState = { ...stateRef.current, profile, draft: profile.intake };
      setSaved(profile);
      await flush(next);
    },
    [flush]
  );

  const resetAll = useCallback(async () => {
    epochRef.current += 1;
    const empty = emptyPersistedState();
    stateRef.current = empty;
    setSaved(null);
    setDraft(empty.draft);
    setPackets(empty.packets);
    setHuddle(empty.huddle);
    setCorpus([]);
    setDialogue([]);
    await enqueueWrite(async () => {
      await clearPersistedState();
    });
  }, [enqueueWrite]);

  const resolvePacket = useCallback(
    async (id: string, status: Packet['status']) => {
      const packetsNext = stateRef.current.packets.map((p) =>
        p.id === id ? { ...p, status } : p
      );
      const next: PersistedState = { ...stateRef.current, packets: packetsNext };
      setPackets(packetsNext);
      await flush(next);
    },
    [flush]
  );

  const appendCorpusItem = useCallback(
    async (
      input: Omit<CorpusItem, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
    ) => {
      const item = createCorpusItem(
        {
          kind: input.kind,
          text: input.text,
          uri: input.uri,
          fileName: input.fileName,
          durationMs: input.durationMs,
        },
        () => input.createdAt ?? new Date().toISOString(),
        () => input.id ?? `c-${Date.now()}`
      );

      const current = stateRef.current;
      const baseIntake = current.profile?.intake ?? current.draft;
      const intake = {
        ...baseIntake,
        corpusNote: mergeCorpusNote(baseIntake.corpusNote, item),
      };
      const corpusNext = [...current.corpus, item];

      if (current.profile) {
        const profile: UserProfile = {
          ...current.profile,
          intake,
          updatedAt: new Date().toISOString(),
        };
        const next: PersistedState = {
          ...current,
          profile,
          draft: intake,
          corpus: corpusNext,
        };
        setSaved(profile);
        setDraft(intake);
        setCorpus(corpusNext);
        await flush(next);
        return item;
      }

      const next: PersistedState = { ...current, draft: intake, corpus: corpusNext };
      setDraft(intake);
      setCorpus(corpusNext);
      await flush(next);
      return item;
    },
    [flush]
  );

  const appendCorpusNote = useCallback(
    async (note: string) => {
      const trimmed = note.trim();
      if (!trimmed) return;
      await appendCorpusItem({ kind: 'text', text: trimmed });
    },
    [appendCorpusItem]
  );

  const runOvernight = useCallback(async () => {
    const current = stateRef.current;
    const intake = current.profile?.intake ?? current.draft;
    const team = current.profile?.team ?? [];
    const result = simulateOvernight({
      intake,
      team,
      packets: current.packets,
      corpus: current.corpus,
    });
    const nextDialogue = mergeHuddleQuestionsIntoDialogue(current.dialogue, result.huddle);
    const next: PersistedState = {
      ...current,
      huddle: result.huddle,
      packets: result.packets,
      dialogue: nextDialogue,
    };
    setHuddle(result.huddle);
    setPackets(result.packets);
    setDialogue(nextDialogue);
    await flush(next);
  }, [flush]);

  const ensureOvernightIfStale = useCallback(async () => {
    const current = stateRef.current;
    if (!current.profile?.intakeComplete) return false;
    if (!isHuddleStale(current.huddle)) return false;
    await runOvernight();
    return true;
  }, [runOvernight]);

  const sendDialogue = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const replies = buildReplyMessages(trimmed);
      const item = createCorpusItem({ kind: 'text', text: trimmed });
      const current = stateRef.current;
      const baseIntake = current.profile?.intake ?? current.draft;
      const intake = {
        ...baseIntake,
        corpusNote: mergeCorpusNote(baseIntake.corpusNote, item),
      };
      const corpusNext = [...current.corpus, item];
      const dialogueNext = [...current.dialogue, ...replies];

      if (current.profile) {
        const profile: UserProfile = {
          ...current.profile,
          intake,
          updatedAt: new Date().toISOString(),
        };
        const next: PersistedState = {
          ...current,
          profile,
          draft: intake,
          corpus: corpusNext,
          dialogue: dialogueNext,
        };
        setSaved(profile);
        setDraft(intake);
        setCorpus(corpusNext);
        setDialogue(dialogueNext);
        await flush(next);
        return;
      }

      const next: PersistedState = {
        ...current,
        draft: intake,
        corpus: corpusNext,
        dialogue: dialogueNext,
      };
      setDraft(intake);
      setCorpus(corpusNext);
      setDialogue(dialogueNext);
      await flush(next);
    },
    [flush]
  );

  const value = useMemo<Store>(() => {
    const profile: UserProfile = saved ?? {
      intakeComplete: false,
      intake: draft,
      team: [],
      createdAt: '',
      updatedAt: '',
    };
    return {
      ready,
      profile,
      huddle,
      packets,
      corpus,
      dialogue,
      updateIntake,
      completeIntake,
      recastSeat,
      resetAll,
      resolvePacket,
      appendCorpusNote,
      appendCorpusItem,
      runOvernight,
      ensureOvernightIfStale,
      sendDialogue,
    };
  }, [
    ready,
    saved,
    draft,
    huddle,
    packets,
    corpus,
    dialogue,
    updateIntake,
    completeIntake,
    recastSeat,
    resetAll,
    resolvePacket,
    appendCorpusNote,
    appendCorpusItem,
    runOvernight,
    ensureOvernightIfStale,
    sendDialogue,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
