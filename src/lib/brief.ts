import { pendingPackets } from './packets';
import type { DialogueMessage, Huddle, Packet } from './types';

/** Depth layer — phone skims; email (later) ships this same object. */
export type BriefPacket = {
  id: string;
  who: string;
  headline: string;
  why: string;
  whyNow: string;
  risk: string;
  nextStep: string;
  sourceHint: string;
  research: string;
  approach: string;
  outreachTo: string;
  outreachSubject: string;
  outreachBody: string;
  status: Packet['status'];
  /** Deep link back into the app decision board. */
  appPath: string;
};

export type MorningBrief = {
  id: string;
  generatedAt: string;
  /** One-line for push/subject. */
  subject: string;
  /** Phone Huddle already shows this short. */
  skim: {
    belief: string;
    pendingCount: number;
    questionCount: number;
  };
  /** Email / Brief screen depth. */
  narrative: string;
  chasing: string[];
  filtered: string[];
  questions: string[];
  packets: BriefPacket[];
  /** Same resolutions the app uses — email CTAs should hit these paths later. */
  actions: {
    openHuddle: string;
    openPackets: string;
    openTalk: string;
    openBrief: string;
  };
};

export type BriefEmailPayload = {
  to: string | null;
  subject: string;
  text: string;
  html: string;
  brief: MorningBrief;
};

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function unansweredCount(dialogue: DialogueMessage[]): number {
  let n = 0;
  for (let i = dialogue.length - 1; i >= 0; i -= 1) {
    const msg = dialogue[i];
    if (msg.from === 'you') break;
    if (msg.from === 'team') n += 1;
  }
  return n;
}

/** Build the shared depth brief from live board state. */
export function buildMorningBrief(input: {
  huddle: Huddle;
  packets: Packet[];
  dialogue: DialogueMessage[];
  now?: () => string;
}): MorningBrief {
  const now = input.now?.() ?? new Date().toISOString();
  const pending = pendingPackets(input.packets);
  const questionCount = unansweredCount(input.dialogue);
  const pendingCount = pending.length;

  const subjectParts = [
    pendingCount > 0
      ? `${pendingCount} option${pendingCount === 1 ? '' : 's'} waiting`
      : 'Nothing waiting',
    truncate(input.huddle.belief, 64),
  ];

  const narrativeParts = [
    input.huddle.belief.trim(),
    pendingCount > 0
      ? `Open Decisions and approve sample outreach for ${pendingCount} lead${pendingCount === 1 ? '' : 's'}.`
      : 'Nothing waiting — run overnight again when you want a fresh research pass.',
    questionCount > 0
      ? `Questions has ${questionCount} item${questionCount === 1 ? '' : 's'} that need you.`
      : null,
    input.huddle.chasing.length > 0
      ? `Still working: ${input.huddle.chasing.map((c) => truncate(c, 72)).join('; ')}.`
      : null,
    input.huddle.filtered.length > 0
      ? `Already passed: ${input.huddle.filtered.map((f) => truncate(f, 72)).join('; ')}.`
      : null,
  ].filter(Boolean);

  const packets: BriefPacket[] = input.packets.map((p) => ({
    id: p.id,
    who: p.who,
    headline: truncate(p.who, 72),
    why: p.why,
    whyNow: p.whyNow,
    risk: p.risk,
    nextStep: p.nextStep,
    sourceHint: p.sourceHint,
    research: p.research,
    approach: p.approach,
    outreachTo: p.outreach.to,
    outreachSubject: p.outreach.subject,
    outreachBody: p.outreach.body,
    status: p.status,
    appPath: `lanyard://packets?focus=${encodeURIComponent(p.id)}`,
  }));

  return {
    id: `brief-${input.huddle.updatedAt || now}`,
    generatedAt: now,
    subject: `Lanyard · ${subjectParts.join(' · ')}`,
    skim: {
      belief: input.huddle.belief,
      pendingCount,
      questionCount,
    },
    narrative: narrativeParts.join('\n\n'),
    chasing: [...input.huddle.chasing],
    filtered: [...input.huddle.filtered],
    questions: [...input.huddle.questions],
    packets,
    actions: {
      openHuddle: 'lanyard://huddle',
      openPackets: 'lanyard://packets',
      openTalk: 'lanyard://talk',
      openBrief: 'lanyard://brief',
    },
  };
}

/** Future overnight-server / ESP payload — same brief, email-shaped. */
export function briefToEmailPayload(
  brief: MorningBrief,
  to: string | null = null
): BriefEmailPayload {
  const lines = [
    brief.subject,
    '',
    brief.narrative,
    '',
    '— Options —',
    ...brief.packets.map(
      (p) =>
        `• [${p.status}] ${p.who}\n  Source: ${p.sourceHint}\n  Why: ${p.why}\n  Research: ${p.research}\n  Approach: ${p.approach}\n  To: ${p.outreachTo || '(you fill this in)'}\n  Sample: ${p.outreachSubject}\n  ${p.outreachBody}\n  Why now: ${p.whyNow}\n  Watch out: ${p.risk}\n  If yes: ${p.nextStep}\n  Open: ${p.appPath}`
    ),
    '',
    `Briefing: ${brief.actions.openHuddle}`,
    `Decisions: ${brief.actions.openPackets}`,
    `Questions: ${brief.actions.openTalk}`,
    `Long version: ${brief.actions.openBrief}`,
  ];

  const text = lines.join('\n');
  const html = `<pre style="font-family:ui-sans-serif,system-ui;white-space:pre-wrap">${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</pre>`;

  return { to, subject: brief.subject, text, html, brief };
}
