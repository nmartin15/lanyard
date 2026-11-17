import { briefToEmailPayload, buildMorningBrief } from '../brief';
import { packetFixture } from '../packets';
import type { DialogueMessage, Huddle, Packet } from '../types';

const huddle: Huddle = {
  belief: 'Bench hunted warm AI consult paths only.',
  chasing: ['Warm intros near angels'],
  questions: ['Still no service businesses?'],
  filtered: ['Cold SaaS spray'],
  updatedAt: '2026-11-16T12:00:00.000Z',
};

const packets: Packet[] = [
  packetFixture({
    id: 'p1',
    who: 'Maya intro',
    why: 'Fit for AI trading consult',
    whyNow: 'Warm path this week',
    risk: 'Low if soft ask',
    nextStep: 'Approve a one-liner',
    research: 'Credible warm path into the room.',
    approach: 'Soft ask, one clear next step.',
    outreach: { to: 'maya@example.com', subject: 'Quick thought', body: 'Hi Maya — careful note.' },
    status: 'pending',
  }),
];

const dialogue: DialogueMessage[] = [
  {
    id: 'd1',
    from: 'team',
    text: 'Still no service businesses?',
    createdAt: '2026-11-16T12:01:00.000Z',
  },
];

describe('morning brief', () => {
  test('builds skim + depth from board state', () => {
    const brief = buildMorningBrief({
      huddle,
      packets,
      dialogue,
      now: () => '2026-11-16T13:00:00.000Z',
    });
    expect(brief.skim.pendingCount).toBe(1);
    expect(brief.skim.questionCount).toBe(1);
    expect(brief.subject).toContain('1 option');
    expect(brief.narrative).toContain('approve sample outreach');
    expect(brief.packets[0].appPath).toContain('p1');
    expect(brief.packets[0].research).toContain('Credible');
    expect(brief.actions.openBrief).toBe('lanyard://brief');
  });

  test('email payload wraps the same brief', () => {
    const brief = buildMorningBrief({ huddle, packets, dialogue });
    const email = briefToEmailPayload(brief, 'you@example.com');
    expect(email.to).toBe('you@example.com');
    expect(email.subject).toBe(brief.subject);
    expect(email.text).toContain('Maya intro');
    expect(email.text).toContain('Research:');
    expect(email.brief).toBe(brief);
  });
});
