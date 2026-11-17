import type { Archetype, Huddle, IntakeDraft, NetworkAltitude, Packet, TeamSeat } from './types';

const ENTREPRENEUR_INVESTOR_BENCH: TeamSeat[] = [
  {
    role: 'deal',
    title: 'Deal lead',
    mandate: 'Find fit opportunities and warm paths in. Skip the spray.',
  },
  {
    role: 'capital',
    title: 'Capital',
    mandate: 'Find LP, check, and co-invest paths that match what you want.',
  },
  {
    role: 'operators',
    title: 'Operators',
    mandate: 'Find talent dens and hires that clear your bar.',
  },
  {
    role: 'structure',
    title: 'Structure',
    mandate: 'Flag tax, entity, and deal structure when it actually matters.',
  },
  {
    role: 'counsel',
    title: 'Counsel',
    mandate: 'Challenge weak goals. Protect your taste and reputation.',
  },
];

const CORPORATE_CLIMBER_BENCH: TeamSeat[] = [
  {
    role: 'sponsor',
    title: 'Sponsor map',
    mandate: 'Who can actually move your next seat — and when.',
  },
  {
    role: 'visibility',
    title: 'Visibility',
    mandate: 'High-signal rooms only. No performative posting.',
  },
  {
    role: 'skills',
    title: 'Skills',
    mandate: 'Gaps that block the next level — and how to close them.',
  },
  {
    role: 'counsel',
    title: 'Counsel',
    mandate: 'Politics, courage, and tradeoffs — mentor voice.',
  },
];

const OPERATOR_BENCH: TeamSeat[] = [
  {
    role: 'operators',
    title: 'Talent',
    mandate: 'Build the team around you.',
  },
  {
    role: 'deal',
    title: 'Partnerships',
    mandate: 'Customer and partner paths worth your time.',
  },
  {
    role: 'structure',
    title: 'Ops structure',
    mandate: 'What to stop, sequence, and protect.',
  },
  {
    role: 'counsel',
    title: 'Counsel',
    mandate: 'Keep the mission honest.',
  },
];

const ALL_BENCHES = [ENTREPRENEUR_INVESTOR_BENCH, CORPORATE_CLIMBER_BENCH, OPERATOR_BENCH];

function altitudeNote(altitude: NetworkAltitude | null): string {
  if (altitude === 'selective') return ' Network is picky — chase fit, not reach.';
  if (altitude === 'established') return ' Warm network on tap — cut noise hard.';
  if (altitude === 'building') return ' Still building the network — warm paths over cold.';
  return '';
}

export function assembleTeam(intake: IntakeDraft): TeamSeat[] {
  const archetype: Archetype = intake.archetype ?? 'other';
  let base: TeamSeat[];
  switch (archetype) {
    case 'entrepreneur_investor':
      base = ENTREPRENEUR_INVESTOR_BENCH;
      break;
    case 'corporate_climber':
      base = CORPORATE_CLIMBER_BENCH;
      break;
    case 'operator':
      base = OPERATOR_BENCH;
      break;
    default:
      base = [...ENTREPRENEUR_INVESTOR_BENCH.slice(0, 2), ENTREPRENEUR_INVESTOR_BENCH[4]];
  }

  const note = altitudeNote(intake.networkAltitude);
  if (!note) return base.map((s) => ({ ...s }));
  return base.map((seat, i) =>
    i === 0 ? { ...seat, mandate: seat.mandate + note } : { ...seat }
  );
}

export function emptyIntake(): IntakeDraft {
  return {
    archetype: null,
    networkAltitude: null,
    goals: '',
    antiGoals: '',
    corpusNote: '',
    respectList: '',
    interruptPolicy: 'rare',
    neverMessageAsMe: true,
    notifyEmail: '',
    mailProvider: 'none',
  };
}

function seatKey(seat: TeamSeat): string {
  return `${seat.role}:${seat.title}`;
}

/** Alternate seats not already on the bench — for recast UI. */
export function alternateSeats(currentTeam: TeamSeat[]): TeamSeat[] {
  const taken = new Set(currentTeam.map(seatKey));
  const seen = new Set<string>();
  const out: TeamSeat[] = [];
  for (const bench of ALL_BENCHES) {
    for (const seat of bench) {
      const key = seatKey(seat);
      if (taken.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ ...seat });
    }
  }
  return out;
}

export function buildHuddle(intake: IntakeDraft, now = () => new Date().toISOString()): Huddle {
  const goals = intake.goals.trim();
  const anti = intake.antiGoals.trim();
  const respect = intake.respectList.trim();
  const archetype = intake.archetype ?? 'other';

  const belief = goals
    ? `Overnight research is hunting relationships that advance: ${goals}`
    : 'Overnight research needs clearer goals before hunting hard.';

  const chasing =
    archetype === 'corporate_climber'
      ? [
          'Sponsor map: who can move the next seat — warm paths only',
          'Visibility: rooms and people that match where you are',
        ]
      : archetype === 'operator'
        ? [
            'Talent dens that clear your bar',
            'Customer / partner paths worth a careful note',
          ]
        : [
            'Operators and deals that fit your goals',
            'Capital paths that match what you want — skip what you don’t',
          ];

  const questions = [
    goals ? `Still true: “${truncate(goals, 80)}”? What shifted?` : 'What should this season’s goals be?',
    anti
      ? `Hard no check: anything to add beyond “${truncate(anti, 60)}”?`
      : 'What’s a hard no the scout should never touch?',
  ];

  const filtered = [
    anti
      ? `Noise that hits your hard no’s (${truncate(anti, 48)})`
      : 'Cold spray with no real overlap',
    respect
      ? `Asks outside people you’d take a call from`
      : 'Random coffee with no mutual context',
  ];

  return {
    belief,
    chasing,
    questions,
    filtered,
    updatedAt: now(),
  };
}

export function buildStarterPackets(
  intake: IntakeDraft,
  now = () => Date.now()
): Packet[] {
  const goals = intake.goals.trim() || 'your stated goals';
  const anti = intake.antiGoals.trim() || 'your hard no’s';
  const respect = intake.respectList.trim();
  const t = now();

  const warmWho = respect
    ? `Operator near: ${truncate(respect, 48)}`
    : 'Operator in a denser pocket of your target ecosystem';

  return [
    {
      id: `p-${t}-1`,
      who: warmWho,
      why: `Maps to your goals — ${truncate(goals, 72)}`,
      whyNow: 'Overnight research pass surfaced fit before noise piles up.',
      risk: intake.neverMessageAsMe
        ? 'Low if the note stays warm and specific; they won’t pretend to be you without approve.'
        : 'Medium if the note reads cold — don’t look spammy.',
      nextStep: 'Read research + sample outreach, then approve to queue send.',
      sourceHint: respect
        ? `Ecosystem scan near people you’d take a call from`
        : 'Public / professional ecosystem scan',
      research: respect
        ? `Scout found overlap with circles around ${truncate(respect, 40)}. Credible path into the room you care about — not someone you already named.`
        : `Scout researched this person against “${truncate(goals, 56)}”. Credible fit; still an external lead, not your existing contact.`,
      approach: 'Short, specific note that names the overlap and asks for one clear next step — no spray.',
      outreach: {
        to: '',
        subject: `Quick thought on ${truncate(goals, 40)}`,
        body: `Hi — I came across your work while looking for people serious about ${truncate(goals, 48)}. The overlap looked real enough to write once, carefully. Open to a short chat if useful on your side?`,
      },
      status: 'pending',
      sendStatus: 'none',
    },
    {
      id: `p-${t}-2`,
      who: 'Open call that smells like spray',
      why: 'Looks busy, weak overlap with what you actually want.',
      whyNow: 'Easy to say yes under deadline pressure — research says skip.',
      risk: `High spam optics vs hard no’s: ${truncate(anti, 64)}`,
      nextStep: 'Pass unless you tweak the brief first.',
      sourceHint: 'Noisy public call / open application',
      research:
        'Thin signal, generic ask, no credible mutual context. Looks like volume outreach dressed as opportunity.',
      approach: 'Do not engage. Keep hunting denser rooms.',
      outreach: {
        to: '',
        subject: '(do not send)',
        body: 'No sample — this is noise. Pass unless you reshape the brief.',
      },
      status: 'pending',
      sendStatus: 'none',
    },
  ];
}

/** @deprecated Prefer buildHuddle(intake) — kept for call-site clarity in tests. */
export function demoHuddleForAlex() {
  return buildHuddle({
    ...emptyIntake(),
    archetype: 'entrepreneur_investor',
    networkAltitude: 'established',
    goals: 'one operator path for Co A and two thesis-fit angel looks',
    antiGoals: 'no tire-kickers, no cold SaaS pitches, no random coffee',
    respectList: 'ops peers you already trust',
  });
}

function truncate(value: string, max: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}
