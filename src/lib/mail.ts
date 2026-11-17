import type { IntakeDraft, MailProvider } from './types';

export function mailProviderLabel(provider: MailProvider): string {
  switch (provider) {
    case 'gmail':
      return 'Gmail';
    case 'microsoft':
      return 'Microsoft 365';
    default:
      return 'Not connected';
  }
}

/** True when intake says Gmail is the chosen send path. */
export function isMailConnected(intake: Pick<IntakeDraft, 'mailProvider'>): boolean {
  return intake.mailProvider === 'gmail';
}

export function mailConnectionCopy(intake: Pick<IntakeDraft, 'mailProvider' | 'notifyEmail'>): string {
  if (intake.mailProvider === 'microsoft') {
    return 'Microsoft 365 send isn’t wired yet. Use Gmail for now.';
  }
  if (!isMailConnected(intake)) {
    return 'Connect Gmail so approved outreach can send from your work email.';
  }
  const inbox = intake.notifyEmail.trim();
  return inbox
    ? `Gmail connected · ${inbox}`
    : 'Gmail connected — waiting for your address from Google.';
}

/** Numbered steps shown in the app while connecting. */
export const GMAIL_USER_STEPS = [
  'Make sure the overnight server is running on your Mac (the same one in your .env).',
  'Tap Connect Gmail below.',
  'Sign in with the Google account you send work email from.',
  'When Google asks for permission, tap Allow (Lanyard only sends mail you approve).',
  'You’ll bounce back here. You should see your Gmail address.',
  'On Decisions: type the recipient’s email, read the sample note, tap Send.',
] as const;
