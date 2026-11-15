import { mergePacketArchive, pendingPackets } from '../packets';
import type { Packet } from '../types';

const packet = (id: string, status: Packet['status']): Packet => ({
  id,
  who: id,
  why: 'y',
  whyNow: 'n',
  risk: 'r',
  nextStep: 's',
  status,
});

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
});
