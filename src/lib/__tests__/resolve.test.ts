import { buildPacketResolutionNotes, homeHref, packetResolutionLabel } from '../resolve';
import { packetFixture } from '../packets';

const packet = packetFixture({
  id: 'p1',
  who: 'Maya intro',
  status: 'pending',
});

describe('resolve helpers', () => {
  test('labels and notes for resolutions', () => {
    expect(packetResolutionLabel('kill')).toBe('Passed');
    const notes = buildPacketResolutionNotes(packet, 'approve', {
      mailConnected: false,
      now: () => 't',
      id: () => 'id1',
    });
    expect(notes.corpusText).toBe('[packet approve] Maya intro');
    expect(notes.dialogue.from).toBe('team');
    expect(notes.dialogue.text).toContain('Approved');
    expect(notes.dialogue.text).toContain('Maya intro');
    expect(notes.sendStatus).toBe('blocked_no_mail');
  });

  test('approve marks sent when sendStatus provided', () => {
    const notes = buildPacketResolutionNotes(packet, 'approve', {
      mailConnected: true,
      sendStatus: 'sent',
      now: () => 't',
      id: () => 'id2',
    });
    expect(notes.sendStatus).toBe('sent');
    expect(notes.dialogue.text).toContain('sent');
  });

  test('homeHref always briefs first after intake', () => {
    expect(homeHref({ intakeComplete: false, pendingCount: 2 })).toBe('/intake');
    expect(homeHref({ intakeComplete: true, pendingCount: 2 })).toBe('/(tabs)/huddle');
    expect(homeHref({ intakeComplete: true, pendingCount: 0 })).toBe('/(tabs)/huddle');
  });
});
