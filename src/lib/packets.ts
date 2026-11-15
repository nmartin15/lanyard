import type { Packet } from './types';

/** Newest-first archive of resolved packets, capped. */
export function mergePacketArchive(
  active: Packet[],
  archive: Packet[],
  limit = 12
): Packet[] {
  const resolved = active.filter((p) => p.status !== 'pending');
  const merged = [...resolved, ...archive];
  const seen = new Set<string>();
  const out: Packet[] = [];
  for (const packet of merged) {
    if (seen.has(packet.id)) continue;
    seen.add(packet.id);
    out.push(packet);
  }
  return out.slice(0, limit);
}

export function pendingPackets(packets: Packet[]): Packet[] {
  return packets.filter((p) => p.status === 'pending');
}
