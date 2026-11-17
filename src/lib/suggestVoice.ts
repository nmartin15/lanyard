import type { Archetype, IntakeDraft, NetworkAltitude } from './types';

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '');
}

function seatLine(archetype: Archetype | null): string {
  switch (archetype) {
    case 'entrepreneur_investor':
      return 'Running companies and writing checks — hate noise.';
    case 'corporate_climber':
      return 'Next title, real sponsors, good rooms — not LinkedIn theater.';
    case 'operator':
      return 'Build the team, land partners, cut busywork.';
    default:
      return 'Keep the bar high and the list short.';
  }
}

function altitudeLine(altitude: NetworkAltitude | null): string {
  switch (altitude) {
    case 'building':
      return 'Warm intros beat cold spray.';
    case 'established':
      return 'Lean on the warm network; cut the junk.';
    case 'selective':
      return 'Chase fit, not reach.';
    default:
      return '';
  }
}

function respectFromArchetype(archetype: Archetype | null): string {
  switch (archetype) {
    case 'entrepreneur_investor':
      return 'Operators who ship; angels who back the idea; closers who close';
    case 'corporate_climber':
      return 'Sponsors with real seats; peers who open doors; operators who clear the bar';
    case 'operator':
      return 'Builders who ship; talent dens that raise the bar; partners who cut noise';
    default:
      return 'People who raise the bar and skip the spray';
  }
}

/** Draft Voice fields from earlier intake — user can edit freely. */
export function suggestVoiceFromIntake(intake: Pick<
  IntakeDraft,
  'archetype' | 'networkAltitude' | 'goals' | 'antiGoals'
>): { corpusNote: string; respectList: string } {
  const goals = clean(intake.goals);
  const anti = clean(intake.antiGoals);
  const seat = seatLine(intake.archetype);
  const altitude = altitudeLine(intake.networkAltitude);

  const winBits = [
    goals ? `I’d be pumped if: ${goals}.` : null,
    seat,
    altitude || null,
    anti ? `Hard no’s: ${anti}.` : null,
    'Only high-signal stuff — no spray, no feed.',
  ].filter(Boolean);

  const respectBits = [
    respectFromArchetype(intake.archetype),
    goals ? `People who can move: ${goals}` : null,
    anti ? `Never: anyone selling the opposite of “${anti}”` : null,
  ].filter(Boolean);

  return {
    corpusNote: winBits.join(' '),
    respectList: respectBits.join('. ').replace(/\.\./g, '.') + (respectBits.length ? '.' : ''),
  };
}
