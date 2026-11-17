import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeIn } from '@/components/FadeIn';
import { Mark, MarkPlate } from '@/components/Marks';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Body, Button, Card, Field } from '@/components/ui';
import { unansweredTeamPrompts } from '@/lib/dialogue';
import { pendingPackets } from '@/lib/packets';
import { useStore } from '@/lib/store';
import { colors, space, type } from '@/lib/theme';

const PHOTO = require('../../../assets/onboarding/team-bench.jpg');

export default function DialogueScreen() {
  const { dialogue, sendDialogue, packets } = useStore();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const packetCount = useMemo(() => pendingPackets(packets).length, [packets]);

  const openQuestions = useMemo(() => {
    const out: { id: string; text: string }[] = [];
    for (let i = dialogue.length - 1; i >= 0; i -= 1) {
      const msg = dialogue[i];
      if (msg.from === 'you') break;
      if (msg.from === 'team') out.unshift({ id: msg.id, text: msg.text });
    }
    return out;
  }, [dialogue]);

  const openCount = unansweredTeamPrompts(dialogue);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    void sendDialogue(trimmed).finally(() => setSending(false));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={8}
      >
        <View style={styles.header}>
          <FadeIn>
            <ScreenHeader
              eyebrow="Questions"
              title="Answer your team"
              lead="Every answer lands in your taste file and steers the next overnight. Skipping this keeps the hunt dumb."
              mark="talk"
              photo={PHOTO}
              photoCaption="Questions here. Decisions next door."
            />
          </FadeIn>
          <FadeIn delay={40}>
            <Card>
              <Body>
                This is how the corpus grows after intake: your replies here + Yes/No on
                Decisions + quick Replies. Short intake is fine — talking back is what trains
                them.
              </Body>
            </Card>
          </FadeIn>
          <FadeIn delay={80}>
            <View style={styles.exits}>
              {packetCount > 0 ? (
                <Button
                  label={`Open Decisions (${packetCount})`}
                  onPress={() => router.navigate('/(tabs)/packets')}
                />
              ) : null}
              <Button
                label="Back to Briefing"
                variant="ghost"
                onPress={() => router.navigate('/(tabs)/huddle')}
              />
            </View>
          </FadeIn>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          }}
        >
          {openCount > 0 ? (
            <FadeIn delay={100}>
              <View style={styles.queue}>
                <View style={styles.queueHead}>
                  <Mark name="ask" size={16} color={colors.ink} />
                  <Text style={styles.queueLabel}>
                    Waiting · {openCount}
                  </Text>
                </View>
                {openQuestions.map((q) => (
                  <Card key={q.id} accent>
                    <View style={styles.askHead}>
                      <MarkPlate name="ask" tone="accent" />
                      <Text style={styles.askFrom}>Your team</Text>
                    </View>
                    <Text style={styles.askText}>{q.text}</Text>
                    <View style={styles.quick}>
                      <Button
                        label="Still true"
                        disabled={sending}
                        onPress={() => send(`Still true: ${q.text}`)}
                      />
                      <Button
                        label="I’ll correct"
                        variant="ghost"
                        disabled={sending}
                        onPress={() => setDraft(`Correction: `)}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            </FadeIn>
          ) : (
            <Body>Nothing open. Ping them anytime.</Body>
          )}

          {dialogue.length > 0 ? (
            <>
              <Text style={styles.historyLabel}>Thread</Text>
              {dialogue.map((m) => (
                <View
                  key={m.id}
                  style={[styles.bubble, m.from === 'you' ? styles.you : styles.team]}
                >
                  <Text style={styles.bubbleLabel}>
                    {m.from === 'you' ? 'You' : 'Team'}
                  </Text>
                  <Text style={styles.bubbleText}>{m.text}</Text>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <Field
            label="Message"
            placeholder="e.g. Still no service businesses — only investors + consult asks."
            value={draft}
            onChangeText={setDraft}
          />
          <Button
            label={sending ? 'Sending…' : 'Send'}
            disabled={!draft.trim() || sending}
            onPress={() => {
              const text = draft;
              setDraft('');
              send(text);
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  exits: { gap: space.sm },
  thread: { padding: space.lg, gap: space.sm, paddingBottom: space.xl, flexGrow: 1 },
  queue: { gap: space.sm, marginBottom: space.sm },
  queueHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  queueLabel: { ...type.label, color: colors.ink },
  askHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  askFrom: { ...type.label, color: colors.ink },
  askText: { ...type.bodyStrong, color: colors.ink },
  quick: { gap: space.sm, marginTop: space.xs },
  historyLabel: { ...type.label, color: colors.inkFaint, marginTop: space.sm },
  bubble: {
    borderRadius: 10,
    padding: space.md,
    gap: 4,
    maxWidth: '92%',
  },
  team: {
    alignSelf: 'stretch',
    backgroundColor: colors.paperDeep,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 3,
    borderLeftColor: colors.ink,
  },
  you: {
    alignSelf: 'stretch',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
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
