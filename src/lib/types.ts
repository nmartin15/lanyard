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

export type IntakeDraft = {
  archetype: Archetype | null;
  networkAltitude: NetworkAltitude | null;
  goals: string;
  antiGoals: string;
  corpusNote: string;
  respectList: string;
  interruptPolicy: 'rare' | 'normal';
  neverMessageAsMe: boolean;
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

export type Packet = {
  id: string;
  who: string;
  why: string;
  whyNow: string;
  risk: string;
  nextStep: string;
  status: 'pending' | PacketAction;
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
