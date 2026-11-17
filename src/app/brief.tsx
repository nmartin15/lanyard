import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IntakeBack } from '@/components/intake/IntakeBack';
import { Body, Button, Card } from '@/components/ui';
import { buildMorningBrief } from '@/lib/brief';
import { postMorningBrief } from '@/lib/briefRemote';
import { overnightRemoteUrl } from '@/lib/overnightRemote';
import { packetStatusLabel } from '@/lib/resolve';
import { useStore } from '@/lib/store';
import { colors, space, type } from '@/lib/theme';

/**
 * Depth surface — same object email sends.
 * Phone Huddle/Packets stay skim; this is the essay.
 */
export default function BriefScreen() {
  const { huddle, packets, dialogue, profile } = useStore();
  const params = useLocalSearchParams<{ packet?: string }>();
  const focusId = typeof params.packet === 'string' ? params.packet : undefined;
  const [sending, setSending] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState<string | null>(null);

  const brief = useMemo(
    () => buildMorningBrief({ huddle, packets, dialogue }),
    [huddle, packets, dialogue]
  );

  const focus = focusId ? brief.packets.find((p) => p.id === focusId) : null;
  const list = focus ? [focus] : brief.packets;
  const notifyEmail = profile.intake.notifyEmail?.trim() || '';
  const serverConfigured = !!overnightRemoteUrl();

  const queueEmail = async () => {
    if (sending) return;
    setSending(true);
    setDeliveryNote(null);
    try {
      const result = await postMorningBrief({
        huddle,
        packets,
        dialogue,
        to: notifyEmail || null,
        send: true,
      });
      if (!result) {
        setDeliveryNote(
          serverConfigured
            ? 'Couldn’t reach the overnight service. Is it running?'
            : 'Turn on the overnight URL, then try again.'
        );
        return;
      }
      const d = result.delivery;
      if (d.status === 'sent') {
        setDeliveryNote(`Sent to ${result.email.to || 'you'}.`);
      } else if (d.status === 'queued') {
        setDeliveryNote(
          `Lined up${result.email.to ? ` for ${result.email.to}` : ''} — check the server outbox.`
        );
      } else if (d.status === 'skipped') {
        setDeliveryNote(d.error || 'Add an email under Setup first.');
      } else {
        setDeliveryNote(d.error || 'Didn’t send. Try again.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <IntakeBack fallback="/(tabs)/huddle" />

        <Text style={styles.eyebrow}>Long version</Text>
        <Text style={styles.title}>{focus ? 'This option' : 'The full write-up'}</Text>
        <Body>
          Same updates as your morning skim — with the story filled in. Emailing sends this
          exact page.
        </Body>

        {!focus ? (
          <Card accent>
            <Text style={styles.label}>The story</Text>
            <Text style={styles.copy}>{brief.narrative}</Text>
          </Card>
        ) : null}

        {!focus && brief.questions.length > 0 ? (
          <Card>
            <Text style={styles.label}>Open questions</Text>
            {brief.questions.map((q) => (
              <Text key={q} style={styles.copy}>
                · {q}
              </Text>
            ))}
            <Button
              label="Answer in Questions"
              variant="ghost"
              onPress={() => router.navigate('/(tabs)/dialogue')}
            />
          </Card>
        ) : null}

        <Text style={styles.section}>
          {focus ? 'This option' : `Options · ${brief.packets.length}`}
        </Text>
        {list.map((p) => (
          <Card key={p.id} accent={p.status === 'pending'}>
            <Text style={styles.who}>{p.who}</Text>
            <Text style={styles.meta}>Status · {packetStatusLabel(p.status)}</Text>
            <Text style={styles.copy}>{p.why}</Text>
            <Text style={styles.meta}>Source · {p.sourceHint}</Text>
            <Text style={styles.copy}>{p.research}</Text>
            <Text style={styles.meta}>Approach · {p.approach}</Text>
            <Text style={styles.meta}>To · {p.outreachTo || '(fill in on Decisions)'}</Text>
            <Text style={styles.meta}>Sample · {p.outreachSubject}</Text>
            <Text style={styles.copy}>{p.outreachBody}</Text>
            <Text style={styles.meta}>Why now · {p.whyNow}</Text>
            <Text style={styles.meta}>Watch out · {p.risk}</Text>
            <Text style={styles.meta}>If yes · {p.nextStep}</Text>
            {p.status === 'pending' ? (
              <Button
                label="Open Decisions"
                onPress={() => router.navigate('/(tabs)/packets')}
              />
            ) : null}
          </Card>
        ))}

        <Card accent>
          <Text style={styles.label}>Email it</Text>
          <Body>Subject: {brief.subject}</Body>
          <Body>
            {notifyEmail
              ? `Sending to ${notifyEmail}`
              : 'No email yet — add one under Setup.'}
          </Body>
          <Button
            label={sending ? 'Sending…' : 'Email me this write-up'}
            disabled={sending}
            onPress={() => {
              void queueEmail();
            }}
          />
          {deliveryNote ? <Body>{deliveryNote}</Body> : null}
        </Card>

        <Button
          label="Back to Briefing"
          variant="ghost"
          onPress={() => router.navigate('/(tabs)/huddle')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  eyebrow: { ...type.label, color: colors.ink },
  title: { ...type.title, color: colors.ink },
  label: { ...type.label, color: colors.ink },
  section: { ...type.label, color: colors.inkFaint, marginTop: space.xs },
  copy: { ...type.body, color: colors.ink },
  who: { ...type.bodyStrong, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
});
