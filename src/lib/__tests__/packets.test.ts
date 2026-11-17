import { mergePacketArchive, packetFixture, pendingPackets } from '../packets';
import type { Packet } from '../types';

const packet = (id: string, status: Packet['status']) => packetFixture({ id, who: id, status });

describe('packets helpers', () => {
  test('pendingPackets filters', () => {
    expect(
      pendingPackets([packet('a', 'pending'), packet('b', 'kill')]).map((p) => p.id)
    ).toEqual(['a']);
  });

  test('mergePacketArchive keeps newest resolved, dedupes, caps', () => {
    const active = [packet('a', 'pending'), packet('b', 'kill'), packet('c', 'approve')];
    const archive = [packet('c', 'approve'), packet('d', 'reshape')];
    const merged = mergePacketArchive(active, archive, 3);
    expect(merged.map((p) => p.id)).toEqual(['b', 'c', 'd']);
    expect(merged.every((p) => p.status !== 'pending')).toBe(true);
  });

  test('packetFixture fills research and outreach', () => {
    const p = packetFixture({ id: 'x', status: 'pending', who: 'Alex' });
    expect(p.research).toContain('Alex');
    expect(p.outreach.subject).toContain('Alex');
    expect(p.sourceHint.length).toBeGreaterThan(0);
  });
});
