import type { Archetype, Huddle, IntakeDraft, NetworkAltitude, Packet, TeamSeat } from './types';

const ENTREPRENEUR_INVESTOR_BENCH: TeamSeat[] = [
  {
    role: 'deal',
    title: 'Deal lead',
    mandate: 'Hunt fit opportunities and warm paths. Never spray.',
  },
  {
    role: 'capital',
    title: 'Capital',
    mandate: 'LP, check, and co-invest paths that match thesis.',
  },
  {
    role: 'operators',
    title: 'Operators',
    mandate: 'Find talent dens and hires that clear your bar.',
  },
  {
    role: 'structure',
    title: 'Structure',
    mandate: 'Tax, entity, and deal structure when it matters.',
  },
  {
    role: 'counsel',
    title: 'Counsel',
    mandate: 'Challenge weak goals. Protect taste and reputation.',
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
    mandate: 'Gaps that block the next level; deliberate practice.',
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
    mandate: 'Build the bench around you.',
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
  if (altitude === 'selective') return ' Network is selective — optimize for fit, not reach.';
  if (altitude === 'established') return ' Warm network exists — cut noise hard.';
  if (altitude === 'building') return ' Building altitude — prioritize warm paths over cold.';
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
    ? `This week your team is oriented to: ${goals}`
    : 'This week your team needs clearer goals from you before hunting hard.';

  const chasing =
    archetype === 'corporate_climber'
      ? [
          'Sponsor map: who can move the next seat — warm paths only',
          'Visibility: high-signal rooms that match your altitude',
        ]
      : archetype === 'operator'
        ? [
            'Talent: dens that clear your bar',
            'Partnerships: customer/partner paths worth your time',
          ]
        : [
            'Deal / operators: fit opportunities aligned to your goals',
            'Capital: paths that clear thesis and anti-goals',
          ];

  const questions = [
    goals ? `Still true: “${truncate(goals, 80)}”? What shifted?` : 'What should this season’s goals be?',
    anti
      ? `Anti-goal check: anything to add beyond “${truncate(anti, 60)}”?`
      : 'What should we never do on your behalf?',
  ];

  const filtered = [
    anti ? `Noise matching anti-goals (${truncate(anti, 48)})` : 'Cold spray with no thesis overlap',
    respect ? 'Asks outside your respect list' : 'Random coffee with no mutual context',
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
  const anti = intake.antiGoals.trim() || 'your anti-goals';
  const respect = intake.respectList.trim();
  const t = now();

  return [
    {
      id: `p-${t}-1`,
      who: respect
        ? `Warm path near: ${truncate(respect, 48)}`
        : 'Warm intro candidate (respect-list adjacent)',
      why: `Maps to your goals — ${truncate(goals, 72)}`,
      whyNow: 'Team flagged fit before noise piles up.',
      risk: intake.neverMessageAsMe
        ? 'Low if warm intro; they will not message as you.'
        : 'Medium if cold; keep optics clean.',
      nextStep: respect
        ? 'Ask a mutual on your respect list for a one-line intro brief.'
        : 'Add respect-list names, then approve a warm ask.',
      status: 'pending',
    },
    {
      id: `p-${t}-2`,
      who: 'Open call that smells like spray',
      why: 'Looks busy, weak overlap with your thesis.',
      whyNow: 'Deadline pressure — easy to say yes by accident.',
      risk: `High spam optics vs anti-goals: ${truncate(anti, 64)}`,
      nextStep: 'Kill unless you reshape the thesis first.',
      status: 'pending',
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
