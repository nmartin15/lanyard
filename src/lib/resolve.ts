import type { DialogueMessage, Packet } from './types';

export function packetResolutionLabel(status: Packet['status']): string {
  switch (status) {
    case 'approve':
      return 'Approved';
    case 'kill':
      return 'Killed';
    case 'reshape':
      return 'Flagged reshape';
    case 'need_human':
      return 'Needs human';
    default:
      return 'Updated';
  }
}

export function buildPacketResolutionNotes(
  packet: Packet,
  status: Exclude<Packet['status'], 'pending'>,
  now = () => new Date().toISOString(),
  id = () => `res-${Date.now()}`
): { corpusText: string; dialogue: DialogueMessage } {
  const label = packetResolutionLabel(status);
  const stamp = now();
  const base = id();
  const who = packet.who.trim() || 'a packet';
  return {
    corpusText: `[packet ${status}] ${who}`,
    dialogue: {
      id: base,
      from: 'team',
      text: `${label}: “${who}”. Logged — overnight will retarget from this.`,
      createdAt: stamp,
    },
  };
}

/** Prefer packets with work waiting; else huddle. */
export function homeHref(input: {
  intakeComplete: boolean;
  pendingCount: number;
}): '/intake' | '/(tabs)/packets' | '/(tabs)/huddle' {
  if (!input.intakeComplete) return '/intake';
  if (input.pendingCount > 0) return '/(tabs)/packets';
  return '/(tabs)/huddle';
}
