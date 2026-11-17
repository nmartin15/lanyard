import type { DialogueMessage, Packet } from './types';

export function packetStatusLabel(packet: Packet | Packet['status']): string {
  const status = typeof packet === 'string' ? packet : packet.status;
  const sendStatus = typeof packet === 'string' ? undefined : packet.sendStatus;
  switch (status) {
    case 'approve':
      if (sendStatus === 'sent') return 'Approved — sent';
      if (sendStatus === 'failed') return 'Approved — send failed';
      if (sendStatus === 'blocked_no_mail') return 'Approved — connect email to send';
      if (sendStatus === 'queued') return 'Approved — outreach queued';
      return 'Approved';
    case 'kill':
      return 'Passed';
    case 'reshape':
      return 'Needs a tweak';
    case 'need_human':
      return 'Needs you';
    case 'pending':
      return 'Waiting';
    default:
      return 'Updated';
  }
}

export function packetResolutionLabel(
  status: Packet['status'],
  sendStatus?: Packet['sendStatus']
): string {
  switch (status) {
    case 'approve':
      if (sendStatus === 'sent') return 'Approved — email sent';
      if (sendStatus === 'failed') return 'Approved — send failed';
      if (sendStatus === 'blocked_no_mail') return 'Approved — connect work email to send';
      if (sendStatus === 'queued') return 'Approved — outreach queued';
      return 'Approved';
    case 'kill':
      return 'Passed';
    case 'reshape':
      return 'Marked for a tweak';
    case 'need_human':
      return 'Needs you';
    default:
      return 'Updated';
  }
}

export function buildPacketResolutionNotes(
  packet: Packet,
  status: Exclude<Packet['status'], 'pending'>,
  opts?: {
    mailConnected?: boolean;
    sendStatus?: Packet['sendStatus'];
    sendError?: string | null;
    now?: () => string;
    id?: () => string;
  }
): { corpusText: string; dialogue: DialogueMessage; sendStatus: Packet['sendStatus'] } {
  const stamp = (opts?.now ?? (() => new Date().toISOString()))();
  const base = (opts?.id ?? (() => `res-${Date.now()}`))();
  const who = packet.who.trim() || 'this one';
  const mailConnected = opts?.mailConnected ?? false;

  let sendStatus: Packet['sendStatus'] = opts?.sendStatus ?? 'none';
  let dialogueText: string;

  if (status === 'approve') {
    if (opts?.sendStatus) {
      sendStatus = opts.sendStatus;
    } else if (!mailConnected) {
      sendStatus = 'blocked_no_mail';
    } else {
      sendStatus = 'queued';
    }

    if (sendStatus === 'sent') {
      dialogueText = `Approved “${who}”. Outreach sent from your Gmail. Next overnight will keep hunting.`;
    } else if (sendStatus === 'failed') {
      dialogueText = `Approved “${who}”, but send failed${
        opts?.sendError ? `: ${opts.sendError}` : '.'
      } Fix Gmail connect or the To address, then try again from a fresh lead.`;
    } else if (sendStatus === 'blocked_no_mail') {
      dialogueText = `Approved “${who}”. Connect Gmail so outreach can send — research stays saved.`;
    } else {
      dialogueText = `Approved “${who}”. Outreach queued. Next overnight will keep hunting.`;
    }
  } else if (status === 'kill') {
    dialogueText = `Passed “${who}”. Got it — next overnight will factor this in.`;
  } else if (status === 'reshape') {
    dialogueText = `Marked “${who}” for a tweak. Tell us what to change in Questions.`;
  } else {
    dialogueText = `Needs you on “${who}”. Answer in Questions when you can.`;
  }

  return {
    corpusText: `[packet ${status}] ${who}`,
    dialogue: {
      id: base,
      from: 'team',
      text: dialogueText,
      createdAt: stamp,
    },
    sendStatus,
  };
}

/** Always land on Huddle after intake — briefing first, then Packets/Talk. */
export function homeHref(input: {
  intakeComplete: boolean;
  pendingCount?: number;
}): '/intake' | '/(tabs)/huddle' {
  if (!input.intakeComplete) return '/intake';
  return '/(tabs)/huddle';
}
