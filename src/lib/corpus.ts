import type { CorpusItem } from './types';

export function createCorpusItem(
  input: {
    kind: CorpusItem['kind'];
    text: string;
    uri?: string;
    fileName?: string;
    durationMs?: number;
  },
  now = () => new Date().toISOString(),
  id = () => `c-${Date.now()}`
): CorpusItem {
  return {
    id: id(),
    kind: input.kind,
    text: input.text.trim(),
    uri: input.uri,
    fileName: input.fileName,
    durationMs: input.durationMs,
    createdAt: now(),
  };
}

export function formatCorpusLine(item: CorpusItem): string {
  if (item.kind === 'voice') {
    const secs =
      typeof item.durationMs === 'number' ? ` (${Math.max(1, Math.round(item.durationMs / 1000))}s)` : '';
    return `[voice${secs}] ${item.text || 'Voice note for the team'}`;
  }
  if (item.kind === 'file') {
    return `[file ${item.fileName ?? 'attachment'}] ${item.text || 'Attached to your notes'}`;
  }
  return item.text;
}

export function mergeCorpusNote(existing: string, item: CorpusItem): string {
  const line = formatCorpusLine(item);
  return existing.trim() ? `${existing.trim()}\n${line}` : line;
}
