export const INTAKE_STEPS = [
  { id: 'you', label: 'You', blurb: 'Who you are now', href: '/intake/archetype' },
  { id: 'ambition', label: 'Ambition', blurb: 'Goals & hard no’s', href: '/intake/goals' },
  { id: 'voice', label: 'Voice', blurb: 'What winning looks like', href: '/intake/corpus' },
  { id: 'rules', label: 'Setup', blurb: 'How often they ping', href: '/intake/constraints' },
  { id: 'team', label: 'Team', blurb: 'Meet your people', href: '/intake/reveal' },
] as const;

export type IntakeStepId = (typeof INTAKE_STEPS)[number]['id'];

export function intakeStepIndex(id: IntakeStepId): number {
  return INTAKE_STEPS.findIndex((step) => step.id === id);
}

/** Prior screen in the linear intake — used when stack history is empty. */
export function intakeBackHref(step: IntakeStepId): '/intake' | (typeof INTAKE_STEPS)[number]['href'] {
  const index = intakeStepIndex(step);
  if (index <= 0) return '/intake';  return INTAKE_STEPS[index - 1].href;
}
