/**
 * Morning brief builder — mirrors src/lib/brief.ts for the Node overnight server.
 * Phone skims; this object is the depth layer (and email payload).
 */

function truncate(text, max) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function pendingPackets(packets) {
  return (packets || []).filter((p) => p?.status === 'pending');
}

function unansweredCount(dialogue) {
  let n = 0;
  const list = dialogue || [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const msg = list[i];
    if (msg?.from === 'you') break;
    if (msg?.from === 'team') n += 1;
  }
  return n;
}

export function buildMorningBrief({ huddle, packets, dialogue, now }) {
  const stamp = typeof now === 'function' ? now() : now || new Date().toISOString();
  const h = huddle || {
    belief: '',
    chasing: [],
    questions: [],
    filtered: [],
    updatedAt: stamp,
  };
  const pending = pendingPackets(packets);
  const questionCount = unansweredCount(dialogue);
  const pendingCount = pending.length;

  const subjectParts = [
    pendingCount > 0
      ? `${pendingCount} move${pendingCount === 1 ? '' : 's'} waiting`
      : 'Board’s clear',
    truncate(h.belief, 64),
  ];

  const narrativeParts = [
    String(h.belief || '').trim(),
    pendingCount > 0
      ? `Hit Packets and greenlight or kill ${pendingCount} move${pendingCount === 1 ? '' : 's'}.`
      : 'Nothing waiting — run another overnight hunt when you want fresh moves.',
    questionCount > 0
      ? `Talk has ${questionCount} question${questionCount === 1 ? '' : 's'} that need you.`
      : null,
    (h.chasing || []).length > 0
      ? `Still chasing: ${h.chasing.map((c) => truncate(c, 72)).join('; ')}.`
      : null,
    (h.filtered || []).length > 0
      ? `Already tossed: ${h.filtered.map((f) => truncate(f, 72)).join('; ')}.`
      : null,
  ].filter(Boolean);

  return {
    id: `brief-${h.updatedAt || stamp}`,
    generatedAt: stamp,
    subject: `Lanyard · ${subjectParts.join(' · ')}`,
    skim: {
      belief: h.belief || '',
      pendingCount,
      questionCount,
    },
    narrative: narrativeParts.join('\n\n'),
    chasing: [...(h.chasing || [])],
    filtered: [...(h.filtered || [])],
    questions: [...(h.questions || [])],
    packets: (packets || []).map((p) => ({
      id: p.id,
      who: p.who,
      headline: truncate(p.who, 72),
      why: p.why,
      whyNow: p.whyNow,
      risk: p.risk,
      nextStep: p.nextStep,
      status: p.status,
      appPath: `lanyard://packets?focus=${encodeURIComponent(p.id)}`,
    })),
    actions: {
      openHuddle: 'lanyard://huddle',
      openPackets: 'lanyard://packets',
      openTalk: 'lanyard://talk',
      openBrief: 'lanyard://brief',
    },
  };
}

export function briefToEmailPayload(brief, to = null) {
  const lines = [
    brief.subject,
    '',
    brief.narrative,
    '',
    '— Moves —',
    ...brief.packets.map(
      (p) =>
        `• [${p.status}] ${p.who}\n  Why: ${p.why}\n  Why now: ${p.whyNow}\n  Risk: ${p.risk}\n  If yes: ${p.nextStep}\n  Open: ${p.appPath}`
    ),
    '',
    `Huddle: ${brief.actions.openHuddle}`,
    `Packets: ${brief.actions.openPackets}`,
    `Talk: ${brief.actions.openTalk}`,
    `Full brief: ${brief.actions.openBrief}`,
  ];
  const text = lines.join('\n');
  const html = `<pre style="font-family:ui-sans-serif,system-ui;white-space:pre-wrap">${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</pre>`;
  return { to, subject: brief.subject, text, html, brief };
}
