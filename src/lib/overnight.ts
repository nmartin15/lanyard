import type { CorpusItem, Huddle, IntakeDraft, Packet, TeamSeat } from './types';

export const HUDDLE_STALE_MS = 8 * 60 * 60 * 1000;

export type OvernightInput = {
  intake: IntakeDraft;
  team: TeamSeat[];
  packets: Packet[];
  corpus: CorpusItem[];
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
  if (team.length === 0) return 'your bench';
  return team
    .slice(0, 3)
    .map((s) => s.title)
    .join(', ');
}

function huntSeats(team: TeamSeat[]): TeamSeat[] {
  const hunters = team.filter((s) => s.role !== 'counsel');
  const pool = hunters.length > 0 ? hunters : team;
  return pool.slice(0, 2);
}

function noisePacket(
  intake: IntakeDraft,
  anti: string,
  seed: number
): Packet {
  const who =
    intake.archetype === 'corporate_climber'
      ? 'High-signal room with weak sponsor map'
      : intake.archetype === 'operator'
        ? 'Talent dens that looks busy, not bar-clearing'
        : 'Deal-flow huddle with thin thesis overlap';

  return {
    id: `p-${seed}-noise`,
    who,
    why: 'Looks urgent; weak overlap with your thesis and bench mandates.',
    whyNow: 'Easy yes under time pressure.',
    risk: anti
      ? `Likely violates: ${truncate(anti, 48)}`
      : 'High spam optics if you show up cold.',
    nextStep: 'Default kill unless you reshape the thesis.',
    status: 'pending',
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

  return {
    id: `p-${seed}-s${index}`,
    who,
    why: `${seat.title} mandate: ${truncate(seat.mandate, 72)}${
      goals ? ` · Goals: ${truncate(goals, 40)}` : ''
    }`,
    whyNow: correction
      ? `Retargeted from your note: “${truncate(correction.text, 48)}”`
      : `${seat.title} surfaced this on the overnight pass.`,
    risk: anti
      ? `Watch anti-goals: ${truncate(anti, 48)}`
      : intake.neverMessageAsMe
        ? 'Low if warm; they will not message as you.'
        : 'Medium if optics unclear.',
    nextStep: approvedCount
      ? 'Approve only if it beats paths already warm on your board.'
      : `Let ${seat.title} advance only if you approve.`,
    status: 'pending',
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
  const { intake, team, packets, corpus } = input;
  const goals = intake.goals.trim();
  const anti = intake.antiGoals.trim();
  const respect = intake.respectList.trim();
  const stamp = now();
  const seed = idSeed();

  const approved = packets.filter((p) => p.status === 'approve');
  const killed = packets.filter((p) => p.status === 'kill');
  const reshape = packets.filter((p) => p.status === 'reshape' || p.status === 'need_human');
  const pending = packets.filter((p) => p.status === 'pending');
  const corrections = latestCorrections(corpus);
  const seats = huntSeats(team);

  const beliefParts = [
    goals
      ? `Overnight, ${seatTitles(team)} hunted against: ${truncate(goals, 72)}`
      : `Overnight, ${seatTitles(team)} waited on clearer goals before hunting hard`,
  ];
  if (seats.length > 0) {
    beliefParts.push(
      `${seats.map((s) => s.title).join(' + ')} led the pass.`
    );
  }
  if (approved.length > 0) {
    beliefParts.push(`${approved.length} path(s) you approved stay warm.`);
  }
  if (corrections.length > 0) {
    beliefParts.push(`Corpus corrections landed (${corrections.length}) — retargeted.`);
  }
  const belief = beliefParts.join(' ');

  const chasing: string[] = [];
  if (approved.length > 0) {
    chasing.push(...approved.slice(0, 2).map((p) => `Advance: ${truncate(p.who, 56)}`));
  }
  for (const seat of seats.slice(0, 2)) {
    chasing.push(
      goals
        ? `${seat.title}: hunt “${truncate(goals, 40)}”`
        : `${seat.title}: ${truncate(seat.mandate, 48)}`
    );
  }
  if (respect) {
    chasing.push(`Warm paths only near: ${truncate(respect, 48)}`);
  } else if (chasing.length < 2) {
    chasing.push('Build respect-list density before cold asks');
  }

  const questions: string[] = [];
  if (reshape.length > 0) {
    questions.push(
      `You flagged reshape/human on “${truncate(reshape[0].who, 40)}” — what should change?`
    );
  }
  if (corrections[0]) {
    questions.push(`Still hold “${truncate(corrections[0].text, 56)}”?`);
  } else if (anti) {
    questions.push(`Anti-goal still hard: “${truncate(anti, 56)}”?`);
  } else {
    questions.push('What should we never do on your behalf?');
  }
  if (questions.length < 2) {
    questions.push(
      goals
        ? `Anything shift on “${truncate(goals, 48)}”?`
        : 'What does winning look like this month?'
    );
  }

  const filtered: string[] = [
    ...killed.slice(0, 3).map((p) => `Killed: ${truncate(p.who, 56)}`),
    anti
      ? `Filtered noise vs anti-goals (${truncate(anti, 40)})`
      : 'Filtered cold spray with no thesis',
  ];
  if (intake.neverMessageAsMe) {
    filtered.push('Blocked any “message as you” drafts');
  }

  const huddle: Huddle = {
    belief,
    chasing: chasing.slice(0, 4),
    questions: questions.slice(0, 3),
    filtered: filtered.slice(0, 5),
    updatedAt: stamp,
  };

  const carried = pending.slice(0, 2);
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
          mandate: 'Hunt fit opportunities carefully.',
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
    packets: [...carried, ...fresh].slice(0, 4),
  };
}
