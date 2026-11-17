import type { CorpusItem, Huddle, IntakeDraft, Packet, TeamSeat } from './types';

export const HUDDLE_STALE_MS = 8 * 60 * 60 * 1000;

export type OvernightInput = {
  intake: IntakeDraft;
  team: TeamSeat[];
  packets: Packet[];
  corpus: CorpusItem[];
  packetArchive?: Packet[];
};

export type OvernightResult = {
  huddle: Huddle;
  packets: Packet[];
};

function truncate(value: string, max: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}

function latestCorrections(corpus: CorpusItem[], limit = 3): CorpusItem[] {
  return [...corpus]
    .filter((c) => c.kind === 'text' || c.kind === 'voice')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

function seatTitles(team: TeamSeat[]): string {
  if (team.length === 0) return 'your team';
  return team
    .slice(0, 3)
    .map((s) => s.title)
    .join(', ');
}

function huntSeats(team: TeamSeat[], limit: number): TeamSeat[] {
  const hunters = team.filter((s) => s.role !== 'counsel');
  const pool = hunters.length > 0 ? hunters : team;
  return pool.slice(0, Math.max(1, limit));
}

function huntSeatLimit(policy: IntakeDraft['interruptPolicy']): number {
  return policy === 'normal' ? 2 : 1;
}

function boardLimit(policy: IntakeDraft['interruptPolicy']): number {
  return policy === 'normal' ? 4 : 3;
}

function altitudeLine(altitude: IntakeDraft['networkAltitude']): string | null {
  if (altitude === 'selective') return 'Network is picky — chase fit, not reach.';
  if (altitude === 'established') return 'You’ve got a warm network — cut noise; warm paths first.';
  if (altitude === 'building') return 'Still building the network — warm paths over cold.';
  return null;
}

function noisePacket(
  intake: IntakeDraft,
  anti: string,
  seed: number
): Packet {
  const who =
    intake.archetype === 'corporate_climber'
      ? 'Busy room with a weak sponsor path'
      : intake.archetype === 'operator'
        ? 'Talent dens that looks busy, not bar-clearing'
        : 'Deal meetup with thin overlap to what you want';

  return {
    id: `p-${seed}-noise`,
    who,
    why: 'Looks urgent; weak overlap with your goals and team roles.',
    whyNow: 'Easy yes under time pressure — research says skip.',
    risk: anti
      ? `Likely hits a hard no: ${truncate(anti, 48)}`
      : 'High spam optics if you show up cold.',
    nextStep: 'Default pass unless you tweak the brief first.',
    sourceHint: 'Noisy public call / open room',
    research:
      'Thin thesis overlap. Looks busy from the outside; no credible mutual context or warm path.',
    approach: 'Do not engage. Keep the scout on denser rooms.',
    outreach: {
      to: '',
      subject: '(do not send)',
      body: 'No sample — this is noise. Pass unless you reshape the brief.',
    },
    status: 'pending',
    sendStatus: 'none',
  };
}

function seatHuntPacket(args: {
  seat: TeamSeat;
  intake: IntakeDraft;
  goals: string;
  anti: string;
  respect: string;
  correction?: CorpusItem;
  approvedCount: number;
  seed: number;
  index: number;
}): Packet {
  const { seat, intake, goals, anti, respect, correction, approvedCount, seed, index } =
    args;

  const who = respect
    ? `${seat.title} find near ${truncate(respect, 36)}`
    : `${seat.title} overnight candidate`;

  const goalBit = goals ? truncate(goals, 48) : 'your stated goals';

  return {
    id: `p-${seed}-s${index}`,
    who,
    why: `${seat.title}: ${truncate(seat.mandate, 72)}${
      goals ? ` · Goals: ${truncate(goals, 40)}` : ''
    }`,
    whyNow: correction
      ? `Retargeted from your note: “${truncate(correction.text, 48)}”`
      : `${seat.title} surfaced this on the research pass.`,
    risk: anti
      ? `Watch hard no’s: ${truncate(anti, 48)}`
      : intake.neverMessageAsMe
        ? 'Low if the note stays warm and specific; they won’t send as you without approve.'
        : 'Medium if it looks weird from the outside.',
    nextStep: approvedCount
      ? 'Approve only if research + sample beat paths already warm.'
      : 'Read research + sample outreach, then approve to queue send.',
    sourceHint: respect
      ? `Ecosystem scan near ${truncate(respect, 40)}`
      : `${seat.title} ecosystem scan`,
    research: correction
      ? `Scout re-ran the hunt after your note (“${truncate(correction.text, 56)}”). ${who} looks like a credible external lead for ${goalBit} — not someone you already named.`
      : `Scout researched this person against ${goalBit}. Credible fit in ${seat.title}'s lane; still an external lead, not your existing contact.`,
    approach: respect
      ? `Warm, specific note that names the overlap near ${truncate(respect, 28)} and asks for one clear next step.`
      : 'Short, specific note that names the real overlap and asks for one clear next step — no spray.',
    outreach: {
      to: '',
      subject: `Quick thought — ${truncate(goalBit, 36)}`,
      body: `Hi — while looking for people serious about ${goalBit}, your work stood out. The overlap looked real enough to write once, carefully. Open to a short chat if useful on your side?`,
    },
    status: 'pending',
    sendStatus: 'none',
  };
}

export function isHuddleStale(
  huddle: Huddle,
  nowMs = Date.now(),
  staleMs = HUDDLE_STALE_MS
): boolean {
  const t = Date.parse(huddle.updatedAt);
  if (Number.isNaN(t)) return true;
  return nowMs - t >= staleMs;
}

/** Deterministic local stand-in for overnight agent hunts. */
export function simulateOvernight(
  input: OvernightInput,
  now = () => new Date().toISOString(),
  idSeed = () => Date.now()
): OvernightResult {
  const { intake, team, packets, corpus, packetArchive = [] } = input;
  const goals = intake.goals.trim();
  const anti = intake.antiGoals.trim();
  const respect = intake.respectList.trim();
  const stamp = now();
  const seed = idSeed();

  const approved = packets.filter((p) => p.status === 'approve');
  const killed = [
    ...packets.filter((p) => p.status === 'kill'),
    ...packetArchive.filter((p) => p.status === 'kill'),
  ];
  const reshape = packets.filter((p) => p.status === 'reshape' || p.status === 'need_human');
  const pending = packets.filter((p) => p.status === 'pending');
  const corrections = latestCorrections(corpus);
  const seatLimit = huntSeatLimit(intake.interruptPolicy);
  const seats = huntSeats(team, seatLimit);
  const maxBoard = boardLimit(intake.interruptPolicy);

  const beliefParts = [
    goals
      ? `Overnight research: ${seatTitles(team)} hunted relationships for ${truncate(goals, 72)}`
      : `Overnight research: ${seatTitles(team)} waited on clearer goals before hunting`,
  ];
  if (seats.length > 0) {
    beliefParts.push(`${seats.map((s) => s.title).join(' + ')} led the pass.`);
  }
  beliefParts.push(
    intake.interruptPolicy === 'normal'
      ? 'Chatty mode — a bit wider when something’s real.'
      : 'Quiet mode — shorter list.'
  );
  const altitude = altitudeLine(intake.networkAltitude);
  if (altitude) beliefParts.push(altitude);
  if (approved.length > 0) {
    beliefParts.push(`${approved.length} approved outreach path(s) stay warm.`);
  }
  if (corrections.length > 0) {
    beliefParts.push(`Your notes landed (${corrections.length}) — we retargeted.`);
  }
  const belief = beliefParts.join(' ');

  const chasing: string[] = [];
  if (approved.length > 0) {
    chasing.push(...approved.slice(0, 2).map((p) => `Advance: ${truncate(p.who, 56)}`));
  }
  if (altitude) chasing.push(altitude);
  for (const seat of seats) {
    chasing.push(
      goals
        ? `${seat.title}: looking for “${truncate(goals, 40)}”`
        : `${seat.title}: ${truncate(seat.mandate, 48)}`
    );
  }
  if (respect) {
    chasing.push(`Warm paths only near: ${truncate(respect, 48)}`);
  } else if (chasing.length < 2) {
    chasing.push('Add people you’d take a call from before cold asks');
  }

  const questions: string[] = [];
  if (reshape.length > 0) {
    questions.push(
      `You asked to tweak “${truncate(reshape[0].who, 40)}” — what should change?`
    );
  }
  if (corrections[0]) {
    questions.push(`Still hold “${truncate(corrections[0].text, 56)}”?`);
  } else if (anti) {
    questions.push(`Hard no still hard: “${truncate(anti, 56)}”?`);
  } else {
    questions.push('What’s a hard no we should never touch?');
  }
  if (questions.length < 2) {
    questions.push(
      goals
        ? `Anything shift on “${truncate(goals, 48)}”?`
        : 'What does winning look like this month?'
    );
  }

  const filtered: string[] = [
    ...killed.slice(0, 3).map((p) => `Passed: ${truncate(p.who, 56)}`),
    anti
      ? `Filtered noise vs hard no’s (${truncate(anti, 40)})`
      : 'Filtered cold outreach with no real overlap',
  ];
  if (intake.neverMessageAsMe) {
    filtered.push('Blocked anything that would pretend to be you');
  }

  const huddle: Huddle = {
    belief,
    chasing: chasing.slice(0, 4),
    questions: questions.slice(0, 3),
    filtered: filtered.slice(0, 5),
    updatedAt: stamp,
  };

  const carried = pending.slice(0, Math.max(1, maxBoard - 2));
  const fresh = seats.map((seat, index) =>
    seatHuntPacket({
      seat,
      intake,
      goals,
      anti,
      respect,
      correction: corrections[0],
      approvedCount: approved.length,
      seed,
      index,
    })
  );
  if (fresh.length === 0) {
    fresh.push(
      seatHuntPacket({
        seat: {
          role: 'deal',
          title: 'Team',
          mandate: 'Find fit opportunities carefully.',
        },
        intake,
        goals,
        anti,
        respect,
        correction: corrections[0],
        approvedCount: approved.length,
        seed,
        index: 0,
      })
    );
  }
  fresh.push(noisePacket(intake, anti, seed));

  return {
    huddle,
    packets: [...carried, ...fresh].slice(0, maxBoard),
  };
}
