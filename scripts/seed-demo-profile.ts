import * as fs from 'node:fs';

import { assembleTeam } from '../src/lib/assembleTeam';
import { createCorpusItem } from '../src/lib/corpus';
import { mergeHuddleQuestionsIntoDialogue } from '../src/lib/dialogue';
import { simulateOvernight } from '../src/lib/overnight';
import type { PersistedState } from '../src/lib/session';

const now = new Date().toISOString();
const intake = {
  archetype: 'entrepreneur_investor' as const,
  networkAltitude: 'building' as const,
  goals:
    'Build an AI consulting practice that ships AI tools for trading workflows and operator leverage — land 2–3 paid consults, open warm investor conversations, and recruit 1–2 salespeople on 100% commission.',
  antiGoals:
    'No service businesses at all. No pitches. No agency spray, SaaS spam, random coffee, or anyone selling me a service.',
  corpusNote:
    'Winning in 12 months: known for practical AI tools around trading + operator leverage, with inbound from investors and serious consult asks. Taste bar: high-signal only. The only people worth hearing from: investors, salespeople who want a 100% commission seat, or folks asking me to consult for them.',
  respectList:
    'Angels/checks into AI tooling; trading/infra builders; closers who eat what they kill on 100% commission; operators who want AI consults that ship.',
  interruptPolicy: 'rare' as const,
  neverMessageAsMe: true,
};

const team = assembleTeam(intake);
const corpus = [
  createCorpusItem(
    {
      kind: 'text',
      text: 'Filter: only investors, 100% commission salespeople, or people asking me to consult.',
    },
    () => now,
    () => 'c-demo-1'
  ),
  createCorpusItem(
    { kind: 'text', text: 'Hard no: service businesses and pitches.' },
    () => now,
    () => 'c-demo-2'
  ),
];
const overnight = simulateOvernight(
  { intake, team, packets: [], corpus, packetArchive: [] },
  () => now,
  () => Date.now()
);
const dialogue = mergeHuddleQuestionsIntoDialogue([], overnight.huddle, () => now);
const profile = {
  intakeComplete: true,
  intake,
  team,
  createdAt: now,
  updatedAt: now,
};
const state: PersistedState = {
  version: 1,
  profile,
  draft: intake,
  huddle: overnight.huddle,
  packets: overnight.packets,
  packetArchive: [],
  corpus,
  dialogue,
};

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('Usage: npx tsx scripts/seed-demo-profile.ts <manifest.json path>');
  process.exit(1);
}

fs.writeFileSync(manifestPath, JSON.stringify({ 'lanyard.state.v1': JSON.stringify(state) }));
console.log('Seeded demo profile →', manifestPath);
console.log('Team:', team.map((t) => t.title).join(', '));
console.log('Packets:', overnight.packets.length);
console.log('Anti:', intake.antiGoals);
