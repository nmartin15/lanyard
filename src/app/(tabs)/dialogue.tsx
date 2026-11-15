import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Eyebrow, Field, Title } from '@/components/ui';
import { useStore } from '@/lib/store';
import { colors, space, type } from '@/lib/theme';

export default function DialogueScreen() {
  const { dialogue, sendDialogue } = useStore();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const send = () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    void sendDialogue(text).finally(() => setSending(false));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Eyebrow>Dialogue</Eyebrow>
        <Title>Team ↔ you</Title>
        <Body>Corrections land in corpus and steer the next overnight hunt.</Body>
      </View>
      <ScrollView contentContainerStyle={styles.thread}>
        {dialogue.length === 0 ? (
          <Body>No thread yet — run a huddle overnight or finish intake.</Body>
        ) : (
          dialogue.map((m) => (
            <View
              key={m.id}
              style={[styles.bubble, m.from === 'you' ? styles.you : styles.team]}
            >
              <Text style={styles.bubbleLabel}>{m.from === 'you' ? 'YOU' : 'TEAM'}</Text>
              <Text style={styles.bubbleText}>{m.text}</Text>
            </View>
          ))
        )}
      </ScrollView>
      <View style={styles.composer}>
        <Field
          label="Reply"
          placeholder="Correct the team…"
          value={draft}
          onChangeText={setDraft}
        />
        <Button
          label={sending ? 'Sending…' : 'Send'}
          disabled={!draft.trim() || sending}
          onPress={send}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xs },
  thread: { padding: space.lg, gap: space.sm, paddingBottom: space.xl },
  bubble: {
    borderRadius: 14,
    padding: space.md,
    gap: 4,
    maxWidth: '92%',
  },
  team: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
  },
  you: {
    alignSelf: 'flex-end',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bubbleLabel: { ...type.label, color: colors.inkFaint },
  bubbleText: { ...type.body, color: colors.ink },
  composer: {
    padding: space.lg,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
});
