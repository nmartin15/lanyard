import type { DialogueMessage, Huddle } from './types';

/** Merge new huddle questions into dialogue without duplicating prior team prompts. */
export function mergeHuddleQuestionsIntoDialogue(
  dialogue: DialogueMessage[],
  huddle: Huddle,
  now = () => new Date().toISOString()
): DialogueMessage[] {
  const existing = new Set(
    dialogue.filter((m) => m.from === 'team').map((m) => m.text.trim())
  );
  const stamp = now();
  const additions: DialogueMessage[] = [];
  huddle.questions.forEach((text, i) => {
    const trimmed = text.trim();
    if (!trimmed || existing.has(trimmed)) return;
    existing.add(trimmed);
    additions.push({
      id: `hq-${huddle.updatedAt}-${i}`,
      from: 'team',
      text: trimmed,
      createdAt: stamp,
    });
  });
  return additions.length ? [...dialogue, ...additions] : dialogue;
}

export function buildReplyMessages(
  text: string,
  now = () => new Date().toISOString(),
  id = () => `d-${Date.now()}`
): DialogueMessage[] {
  const stamp = now();
  const base = id();
  return [
    { id: base, from: 'you', text: text.trim(), createdAt: stamp },
    {
      id: `${base}-r`,
      from: 'team',
      text: 'Logged. We’ll retarget hunts from that. Anything else to correct?',
      createdAt: stamp,
    },
  ];
}

export function buildVoiceReplyMessages(
  caption: string,
  now = () => new Date().toISOString(),
  id = () => `d-${Date.now()}`
): DialogueMessage[] {
  const stamp = now();
  const base = id();
  const label = caption.trim() || 'Voice note for the team';
  return [
    { id: base, from: 'you', text: `Voice: ${label}`, createdAt: stamp },
    {
      id: `${base}-r`,
      from: 'team',
      text: 'Voice note logged into corpus. We’ll retarget hunts from that.',
      createdAt: stamp,
    },
  ];
}

/** Team prompts since the last user reply — drives Talk tab badge. */
export function unansweredTeamPrompts(dialogue: DialogueMessage[]): number {
  let count = 0;
  for (let i = dialogue.length - 1; i >= 0; i -= 1) {
    const msg = dialogue[i];
    if (msg.from === 'you') break;
    if (msg.from === 'team') count += 1;
  }
  return count;
}
