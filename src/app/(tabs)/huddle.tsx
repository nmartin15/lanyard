import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Card, Eyebrow, Title } from '@/components/ui';
import { useStore } from '@/lib/store';
import { colors, space, type } from '@/lib/theme';

function formatWhen(iso: string): string {
  if (!iso) return 'not yet';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function HuddleScreen() {
  const { huddle, runOvernight, ensureOvernightIfStale, profile } = useStore();
  const [running, setRunning] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const autoTried = useRef(false);

  useEffect(() => {
    if (!profile.intakeComplete || autoTried.current) return;
    autoTried.current = true;
    void ensureOvernightIfStale().then((did) => {
      if (did) setAutoNote('Stale huddle — ran an overnight hunt for you.');
    });
  }, [ensureOvernightIfStale, profile.intakeComplete]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Eyebrow>Morning huddle</Eyebrow>
        <Title>What your team did overnight</Title>
        <Body>Last hunt: {formatWhen(huddle.updatedAt)}. Local simulation until real workers.</Body>
        {autoNote ? <Body>{autoNote}</Body> : null}
        <Button
          label={running ? 'Hunting…' : 'Run overnight hunt'}
          disabled={running}
          onPress={() => {
            setRunning(true);
            setAutoNote(null);
            void runOvernight().finally(() => setRunning(false));
          }}
        />
        <Card>
          <Text style={styles.label}>WE BELIEVE</Text>
          <Text style={styles.copy}>{huddle.belief}</Text>
        </Card>
        <Card>
          <Text style={styles.label}>CHASING</Text>
          {huddle.chasing.map((c) => (
            <Text key={c} style={styles.copy}>
              · {c}
            </Text>
          ))}
        </Card>
        <Card>
          <Text style={styles.label}>NEED FROM YOU</Text>
          {huddle.questions.map((q) => (
            <Text key={q} style={styles.copy}>
              · {q}
            </Text>
          ))}
        </Card>
        <Card>
          <Text style={styles.label}>FILTERED OUT</Text>
          {huddle.filtered.map((f) => (
            <Text key={f} style={styles.copy}>
              · {f}
            </Text>
          ))}
          <Body>Silence outward is work. This is proof.</Body>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  label: { ...type.label, color: colors.accent },
  copy: { ...type.body, color: colors.ink },
});
