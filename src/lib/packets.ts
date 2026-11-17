import type { OutreachDraft, Packet } from './types';

function asOutreach(value: Packet['outreach'] | undefined, who: string): OutreachDraft {
  if (value && typeof value.subject === 'string' && typeof value.body === 'string') {
    return {
      to: typeof value.to === 'string' ? value.to.trim() : '',
      subject: value.subject.trim() || `Quick note — ${who}`,
      body: value.body.trim() || 'Short, careful outreach draft.',
    };
  }
  return {
    to: '',
    subject: `Quick note — ${who}`,
    body: 'Short, careful outreach draft based on research.',
  };
}

/** Fill research/outreach fields for older persisted packets. */
export function normalizePacket(packet: Packet): Packet {
  const who = packet.who?.trim() || 'Candidate';
  return {
    ...packet,
    who,
    why: packet.why?.trim() || 'Fit against your goals.',
    whyNow: packet.whyNow?.trim() || 'Surfaced on the overnight research pass.',
    risk: packet.risk?.trim() || 'Review optics before sending.',
    nextStep: packet.nextStep?.trim() || 'Approve to queue outreach, or pass.',
    sourceHint: packet.sourceHint?.trim() || 'Public / professional ecosystem scan',
    research: packet.research?.trim() || `Research pending on ${who}.`,
    approach: packet.approach?.trim() || 'Warm, specific, no spray-and-pray.',
    outreach: asOutreach(packet.outreach, who),
    sendStatus: packet.sendStatus ?? 'none',
  };
}

export function normalizePackets(packets: Packet[]): Packet[] {
  return packets.map(normalizePacket);
}

/** Test / stub helper — fills research + outreach defaults. */
export function packetFixture(
  partial: Partial<Packet> & Pick<Packet, 'id' | 'status'>
): Packet {
  return normalizePacket({
    id: partial.id,
    who: partial.who ?? partial.id,
    why: partial.why ?? 'y',
    whyNow: partial.whyNow ?? 'n',
    risk: partial.risk ?? 'r',
    nextStep: partial.nextStep ?? 's',
    sourceHint: partial.sourceHint ?? '',
    research: partial.research ?? '',
    approach: partial.approach ?? '',
    outreach: partial.outreach ?? { to: '', subject: '', body: '' },
    status: partial.status,
    sendStatus: partial.sendStatus ?? 'none',
  });
}

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
    out.push(normalizePacket(packet));
  }
  return out.slice(0, limit);
}

export function pendingPackets(packets: Packet[]): Packet[] {
  return packets.filter((p) => p.status === 'pending');
}
