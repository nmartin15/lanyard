import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { STATE_KEY } from '../session';
import { StoreProvider, useStore } from '../store';

function wrapper({ children }: { children: React.ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}

describe('StoreProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('autosaves intake draft and completes with intake-derived huddle/packets', async () => {
    const { result } = await renderHook(() => useStore(), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.updateIntake({
        archetype: 'entrepreneur_investor',
        networkAltitude: 'selective',
        goals: 'one operator hire',
        antiGoals: 'no cold decks',
        respectList: 'ops peers',
      });
    });

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(STATE_KEY);
      expect(raw).toContain('one operator hire');
    });

    await act(async () => {
      await result.current.completeIntake();
    });

    expect(result.current.profile.intakeComplete).toBe(true);
    expect(result.current.profile.team[0].role).toBe('deal');
    expect(result.current.profile.team[0].mandate).toContain('selective');
    expect(result.current.huddle.belief).toContain('one operator hire');
    expect(result.current.packets.length).toBeGreaterThanOrEqual(2);
    expect(result.current.packets.some((p) => p.who.includes('Deal lead'))).toBe(true);
    expect(result.current.packets.some((p) => p.who.includes('ops peers'))).toBe(true);
  });

  test('persists packet resolution and seat recast', async () => {
    const { result } = await renderHook(() => useStore(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.updateIntake({
        archetype: 'corporate_climber',
        goals: 'next seat',
        antiGoals: 'no performative posting',
      });
      await result.current.completeIntake();
    });

    const packetId = result.current.packets[0].id;

    await act(async () => {
      await result.current.resolvePacket(packetId, 'kill');
    });

    expect(result.current.packets.find((p) => p.id === packetId)?.status).toBe('kill');
    expect(result.current.dialogue.some((m) => m.text.includes('Killed'))).toBe(true);
    expect(result.current.profile.intake.corpusNote).toContain('[packet kill]');

    await act(async () => {
      await result.current.recastSeat(0, {
        role: 'deal',
        title: 'Deal lead',
        mandate: 'Recast test',
      });
    });

    await act(async () => {
      await result.current.appendCorpusNote('keep quiet on LinkedIn');
      await result.current.sendWalkVoice({
        uri: 'file://walk.m4a',
        caption: 'walk correction',
        durationMs: 1200,
      });
      await result.current.appendCorpusItem({
        kind: 'file',
        text: 'Attached memo.pdf',
        uri: 'file://memo.pdf',
        fileName: 'memo.pdf',
      });
    });

    expect(result.current.profile.team[0].title).toBe('Deal lead');
    expect(result.current.profile.intake.corpusNote).toContain('keep quiet on LinkedIn');
    expect(result.current.profile.intake.corpusNote).toContain('[voice');
    expect(result.current.dialogue.some((m) => m.text === 'Voice: walk correction')).toBe(true);
    expect(result.current.corpus.map((c) => c.kind)).toEqual(
      expect.arrayContaining(['text', 'voice', 'file'])
    );

    const raw = await AsyncStorage.getItem(STATE_KEY);
    expect(raw).toContain('"status":"kill"');
    expect(raw).toContain('Deal lead');
    expect(raw).toContain('keep quiet on LinkedIn');
    expect(raw).toContain('walk.m4a');
    expect(raw).toContain('memo.pdf');
  });

  test('runOvernight refreshes huddle, packets, and dialogue', async () => {
    const { result } = await renderHook(() => useStore(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.updateIntake({
        archetype: 'operator',
        goals: 'hire a lead',
        antiGoals: 'no chaos hires',
        respectList: 'ops circle',
      });
      await result.current.completeIntake();
    });

    expect(result.current.dialogue.some((m) => m.from === 'team')).toBe(true);
    const dialogueBefore = result.current.dialogue.length;

    const firstId = result.current.packets[0].id;
    await act(async () => {
      await result.current.resolvePacket(firstId, 'kill');
      await result.current.appendCorpusNote('prefer player-coaches');
      await result.current.runOvernight();
      await result.current.sendDialogue('keep bar high');
    });

    expect(result.current.huddle.belief).toContain('hire a lead');
    expect(result.current.huddle.filtered.some((f) => f.startsWith('Killed:'))).toBe(true);
    expect(result.current.packets.every((p) => p.status === 'pending')).toBe(true);
    expect(result.current.packets.some((p) => p.id === firstId)).toBe(false);
    expect(result.current.packetArchive.some((p) => p.id === firstId)).toBe(true);
    expect(result.current.dialogue.length).toBeGreaterThan(dialogueBefore);
    expect(result.current.dialogue.some((m) => m.text === 'keep bar high')).toBe(true);

    const raw = await AsyncStorage.getItem(STATE_KEY);
    expect(raw).toContain('hire a lead');
    expect(raw).toContain('prefer player-coaches');
    expect(raw).toContain('keep bar high');
  });

  test('fresh huddle skips ensureOvernightIfStale; stale state refreshes on load', async () => {
    const { result } = await renderHook(() => useStore(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.updateIntake({
        goals: 'ship',
        antiGoals: 'no spam',
      });
      await result.current.completeIntake();
    });

    let ran = true;
    await act(async () => {
      ran = await result.current.ensureOvernightIfStale();
    });
    expect(ran).toBe(false);

    const raw = await AsyncStorage.getItem(STATE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    const staleStamp = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    parsed.huddle.updatedAt = staleStamp;
    parsed.packets = [
      {
        id: 'stale-kill',
        who: 'Stale kill',
        why: 'y',
        whyNow: 'n',
        risk: 'r',
        nextStep: 's',
        status: 'kill',
      },
    ];
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(parsed));

    const { result: result2 } = await renderHook(() => useStore(), { wrapper });
    await waitFor(() => expect(result2.current.ready).toBe(true));
    // App-open refresh already ran — huddle should no longer be the stale stamp.
    expect(result2.current.huddle.updatedAt).not.toBe(staleStamp);
    expect(result2.current.packetArchive.some((p) => p.id === 'stale-kill')).toBe(true);
    expect(result2.current.packets.every((p) => p.status === 'pending')).toBe(true);

    let ranAgain = true;
    await act(async () => {
      ranAgain = await result2.current.ensureOvernightIfStale();
    });
    expect(ranAgain).toBe(false);
  });

  test('reset clears persisted state', async () => {
    const { result } = await renderHook(() => useStore(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.updateIntake({ goals: 'temp', antiGoals: 'temp' });
      await result.current.completeIntake();
      await result.current.resetAll();
    });

    expect(result.current.profile.intakeComplete).toBe(false);
    expect(result.current.profile.team).toEqual([]);
    expect(await AsyncStorage.getItem(STATE_KEY)).toBeNull();
  });
});
