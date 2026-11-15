import { createCorpusItem, formatCorpusLine, mergeCorpusNote } from '../corpus';

describe('corpus helpers', () => {
  test('creates text, voice, and file items', () => {
    const text = createCorpusItem(
      { kind: 'text', text: '  no SaaS  ' },
      () => 't1',
      () => 'id-1'
    );
    expect(text).toEqual({
      id: 'id-1',
      kind: 'text',
      text: 'no SaaS',
      uri: undefined,
      fileName: undefined,
      durationMs: undefined,
      createdAt: 't1',
    });

    const voice = createCorpusItem(
      {
        kind: 'voice',
        text: 'hold anti-goals',
        uri: 'file://note.m4a',
        durationMs: 2500,
      },
      () => 't2',
      () => 'id-2'
    );
    expect(voice.uri).toBe('file://note.m4a');
    expect(formatCorpusLine(voice)).toBe('[voice (3s)] hold anti-goals');

    const file = createCorpusItem(
      {
        kind: 'file',
        text: 'Attached thesis.pdf',
        uri: 'file://thesis.pdf',
        fileName: 'thesis.pdf',
      },
      () => 't3',
      () => 'id-3'
    );
    expect(formatCorpusLine(file)).toBe('[file thesis.pdf] Attached thesis.pdf');
  });

  test('mergeCorpusNote appends lines', () => {
    const item = createCorpusItem(
      { kind: 'text', text: 'second' },
      () => 't',
      () => 'i'
    );
    expect(mergeCorpusNote('', item)).toBe('second');
    expect(mergeCorpusNote('first', item)).toBe('first\nsecond');
  });
});
