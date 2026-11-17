export type Archetype = 'entrepreneur_investor' | 'corporate_climber' | 'operator' | 'other';

export type NetworkAltitude = 'building' | 'established' | 'selective';

export type SeatRole =
  | 'deal'
  | 'capital'
  | 'operators'
  | 'structure'
  | 'counsel'
  | 'sponsor'
  | 'visibility'
  | 'skills';

export type TeamSeat = {
  role: SeatRole;
  title: string;
  mandate: string;
};

/** Work mail the outreach agent will send from after you approve. */
export type MailProvider = 'none' | 'gmail' | 'microsoft';

export type IntakeDraft = {
  archetype: Archetype | null;
  networkAltitude: NetworkAltitude | null;
  goals: string;
  antiGoals: string;
  corpusNote: string;
  respectList: string;
  interruptPolicy: 'rare' | 'normal';
  neverMessageAsMe: boolean;
  /** Morning brief email — depth layer; optional. */
  notifyEmail: string;
  /** Where outreach sends from. none = research/approve only until connected. */
  mailProvider: MailProvider;
};

export type CorpusItem = {
  id: string;
  kind: 'text' | 'voice' | 'file';
  text: string;
  uri?: string;
  fileName?: string;
  durationMs?: number;
  createdAt: string;
};

export type UserProfile = {
  intakeComplete: boolean;
  intake: IntakeDraft;
  team: TeamSeat[];
  createdAt: string;
  updatedAt: string;
};

export type PacketAction = 'approve' | 'kill' | 'reshape' | 'need_human';

export type OutreachDraft = {
  /** Recipient email — human confirms/edits before Send. */
  to: string;
  subject: string;
  body: string;
};

/**
 * A researched relationship candidate from the overnight scout —
 * not something the user already brought in.
 */
export type Packet = {
  id: string;
  who: string;
  why: string;
  whyNow: string;
  risk: string;
  nextStep: string;
  /** Ecosystem / where the scout looked. */
  sourceHint: string;
  /** Lead research summary. */
  research: string;
  /** How to approach this relationship. */
  approach: string;
  /** Sample outreach waiting for your approve. */
  outreach: OutreachDraft;
  status: 'pending' | PacketAction;
  /** After approve: sent via Gmail API, failed, blocked, or legacy queued. */
  sendStatus?: 'none' | 'queued' | 'sent' | 'failed' | 'blocked_no_mail';
};

export type Huddle = {
  belief: string;
  chasing: string[];
  questions: string[];
  filtered: string[];
  updatedAt: string;
};

export type DialogueMessage = {
  id: string;
  from: 'team' | 'you';
  text: string;
  createdAt: string;
};
