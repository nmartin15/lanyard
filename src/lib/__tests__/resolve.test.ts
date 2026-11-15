import { buildPacketResolutionNotes, homeHref, packetResolutionLabel } from '../resolve';
import type { Packet } from '../types';

const packet: Packet = {
  id: 'p1',
  who: 'Maya intro',
  why: 'y',
  whyNow: 'n',
  risk: 'r',
  nextStep: 's',
  status: 'pending',
};

describe('resolve helpers', () => {
  test('labels and notes for resolutions', () => {
    expect(packetResolutionLabel('kill')).toBe('Killed');
    const notes = buildPacketResolutionNotes(packet, 'approve', () => 't', () => 'id1');
    expect(notes.corpusText).toBe('[packet approve] Maya intro');
    expect(notes.dialogue.from).toBe('team');
    expect(notes.dialogue.text).toContain('Approved');
    expect(notes.dialogue.text).toContain('Maya intro');
  });

  test('homeHref routes by board state', () => {
    expect(homeHref({ intakeComplete: false, pendingCount: 2 })).toBe('/intake');
    expect(homeHref({ intakeComplete: true, pendingCount: 2 })).toBe('/(tabs)/packets');
    expect(homeHref({ intakeComplete: true, pendingCount: 0 })).toBe('/(tabs)/huddle');
  });
});
