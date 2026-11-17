import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { assembleTeam, buildStarterPackets, emptyIntake } from './assembleTeam';
import { createCorpusItem, mergeCorpusNote } from './corpus';
import {
  buildReplyMessages,
  buildVoiceReplyMessages,
  mergeHuddleQuestionsIntoDialogue,
} from './dialogue';
import { sendOutreachEmail } from './gmail';
import { isMailConnected } from './mail';
import { runOvernightHunt } from './overnightProvider';
import { applyOvernightToState, refreshIfStale } from './refresh';
import { buildPacketResolutionNotes } from './resolve';
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
  packetArchive: Packet[];
  corpus: CorpusItem[];
  dialogue: DialogueMessage[];
  updateIntake: (patch: Partial<IntakeDraft>) => Promise<void>;
  completeIntake: () => Promise<void>;
  recastSeat: (index: number, seat: TeamSeat) => Promise<void>;
  resetAll: () => Promise<void>;
  resolvePacket: (
    id: string,
    status: Packet['status'],
    opts?: { outreachTo?: string }
  ) => Promise<{ sendStatus?: Packet['sendStatus']; sendError?: string | null }>;
  appendCorpusNote: (note: string) => Promise<void>;
  appendCorpusItem: (
    input: Omit<CorpusItem, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
  ) => Promise<CorpusItem>;
  runOvernight: () => Promise<PersistedState>;
  ensureOvernightIfStale: () => Promise<boolean>;
  sendDialogue: (text: string) => Promise<void>;
  sendWalkVoice: (input: {
    uri: string;
    caption?: string;
    durationMs?: number;
  }) => Promise<CorpusItem>;
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
  const empty = emptyPersistedState();
  const [huddle, setHuddle] = useState<Huddle>(empty.huddle);
  const [packets, setPackets] = useState<Packet[]>(() => buildStarterPackets(emptyIntake()));
  const [packetArchive, setPacketArchive] = useState<Packet[]>([]);
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
      // Commit sync before any await so a later pick can't be rewound by a stale flush.
      stateRef.current = next;
      const epoch = epochRef.current;
      await enqueueWrite(async () => {
        if (epoch !== epochRef.current) return;
        // Always persist the latest ref — another sync update may have landed.
        await savePersistedState(stateRef.current);
      });
    },
    [enqueueWrite]
  );

  useEffect(() => {
    (async () => {
      try {
        const loaded = await loadPersistedState();
        const { state, didRefresh } = await refreshIfStale(loaded);
        if (didRefresh) {
          await savePersistedState(state);
        }
        stateRef.current = state;
        setSaved(state.profile);
        setDraft(state.draft);
        setHuddle(state.huddle);
        setPackets(state.packets);
        setPacketArchive(state.packetArchive);
        setCorpus(state.corpus);
        setDialogue(state.dialogue);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const updateIntake = useCallback(
    async (patch: Partial<IntakeDraft>) => {
      // Keep stateRef in sync before any await so rapid picks don't clobber each other.
      const nextDraft = { ...stateRef.current.draft, ...patch };
      const next: PersistedState = {
        ...stateRef.current,
        draft: nextDraft,
        profile: stateRef.current.profile
          ? { ...stateRef.current.profile, intake: nextDraft }
          : null,
      };
      stateRef.current = next;
      setDraft(nextDraft);
      if (next.profile) setSaved(next.profile);
      await flush(next);
    },
    [flush]
  );

  const completeIntake = useCallback(async () => {
    const intake = stateRef.current.draft;
    const profile = newProfile(intake);
    const { result } = await runOvernightHunt({
      intake,
      team: profile.team,
      packets: [],
      corpus: stateRef.current.corpus,
      packetArchive: [],
    });
    const nextDialogue = mergeHuddleQuestionsIntoDialogue([], result.huddle);
    const next: PersistedState = {
      version: 1,
      profile,
      draft: intake,
      huddle: result.huddle,
      packets: result.packets,
      packetArchive: [],
      corpus: stateRef.current.corpus,
      dialogue: nextDialogue,
    };
    setSaved(profile);
    setDraft(intake);
    setHuddle(result.huddle);
    setPackets(result.packets);
    setPacketArchive([]);
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
    const cleared = emptyPersistedState();
    stateRef.current = cleared;
    setSaved(null);
    setDraft(cleared.draft);
    setPackets(cleared.packets);
    setPacketArchive([]);
    setHuddle(cleared.huddle);
    setCorpus([]);
    setDialogue([]);
    await enqueueWrite(async () => {
      await clearPersistedState();
    });
  }, [enqueueWrite]);

  const resolvePacket = useCallback(
    async (id: string, status: Packet['status'], opts?: { outreachTo?: string }) => {
      if (status === 'pending') return {};
      const current = stateRef.current;
      const target = current.packets.find((p) => p.id === id);
      if (!target || target.status !== 'pending') return {};

      const baseIntake = current.profile?.intake ?? current.draft;
      const mailConnected = isMailConnected(baseIntake);
      const outreachTo = (opts?.outreachTo ?? target.outreach.to).trim();
      const targetWithTo: Packet = {
        ...target,
        outreach: { ...target.outreach, to: outreachTo },
      };

      let sendStatus: Packet['sendStatus'] = 'none';
      let sendError: string | null = null;

      if (status === 'approve') {
        if (!mailConnected) {
          sendStatus = 'blocked_no_mail';
        } else if (
          targetWithTo.outreach.subject.toLowerCase().includes('do not send') ||
          targetWithTo.approach.toLowerCase().includes('do not engage')
        ) {
          sendStatus = 'queued';
        } else if (!outreachTo.includes('@')) {
          sendStatus = 'failed';
          sendError = 'Add a recipient email (To) before sending.';
        } else {
          const result = await sendOutreachEmail({
            to: outreachTo,
            subject: targetWithTo.outreach.subject,
            body: targetWithTo.outreach.body,
          });
          if (result.ok) {
            sendStatus = 'sent';
          } else {
            sendStatus = 'failed';
            sendError = result.error;
          }
        }
      }

      const notes = buildPacketResolutionNotes(targetWithTo, status, {
        mailConnected,
        sendStatus,
        sendError,
      });
      const packetsNext = current.packets.map((p) =>
        p.id === id
          ? {
              ...p,
              outreach: { ...p.outreach, to: outreachTo },
              status,
              sendStatus: notes.sendStatus,
            }
          : p
      );
      const item = createCorpusItem({ kind: 'text', text: notes.corpusText });
      const intake = {
        ...baseIntake,
        corpusNote: mergeCorpusNote(baseIntake.corpusNote, item),
      };
      const corpusNext = [...current.corpus, item];
      const dialogueNext = [...current.dialogue, notes.dialogue];

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
          packets: packetsNext,
          corpus: corpusNext,
          dialogue: dialogueNext,
        };
        setSaved(profile);
        setDraft(intake);
        setPackets(packetsNext);
        setCorpus(corpusNext);
        setDialogue(dialogueNext);
        await flush(next);
        return { sendStatus: notes.sendStatus, sendError };
      }

      const next: PersistedState = {
        ...current,
        draft: intake,
        packets: packetsNext,
        corpus: corpusNext,
        dialogue: dialogueNext,
      };
      setDraft(intake);
      setPackets(packetsNext);
      setCorpus(corpusNext);
      setDialogue(dialogueNext);
      await flush(next);
      return { sendStatus: notes.sendStatus, sendError };
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
    const next = await applyOvernightToState(stateRef.current);
    setHuddle(next.huddle);
    setPackets(next.packets);
    setPacketArchive(next.packetArchive);
    setDialogue(next.dialogue);
    await flush(next);
    return next;
  }, [flush]);

  const ensureOvernightIfStale = useCallback(async () => {
    const { state, didRefresh } = await refreshIfStale(stateRef.current);
    if (!didRefresh) return false;
    setHuddle(state.huddle);
    setPackets(state.packets);
    setPacketArchive(state.packetArchive);
    setDialogue(state.dialogue);
    await flush(state);
    return true;
  }, [flush]);

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

  const sendWalkVoice = useCallback(
    async (input: { uri: string; caption?: string; durationMs?: number }) => {
      const caption = (input.caption ?? '').trim() || 'Voice note for the team';
      const item = createCorpusItem({
        kind: 'voice',
        text: caption,
        uri: input.uri,
        durationMs: input.durationMs,
      });
      const replies = buildVoiceReplyMessages(caption);
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
        return item;
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
      return item;
    },
    [flush]
  );

  const value = useMemo<Store>(() => {
    // Draft is the live intake source of truth so selections re-render immediately.
    const profile: UserProfile = saved
      ? { ...saved, intake: draft }
      : {
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
      packetArchive,
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
      sendWalkVoice,
    };
  }, [
    ready,
    saved,
    draft,
    huddle,
    packets,
    packetArchive,
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
    sendWalkVoice,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
