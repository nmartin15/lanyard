import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Card, Eyebrow, Title } from '@/components/ui';
import { formatWhen } from '@/lib/format';
import { freshnessCopy, huddleFreshness } from '@/lib/freshness';
import { pendingPackets } from '@/lib/packets';
import { useStore } from '@/lib/store';
import { colors, space, type } from '@/lib/theme';

export default function HuddleScreen() {
  const { huddle, runOvernight, ensureOvernightIfStale, profile, packets } = useStore();
  const [running, setRunning] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const autoTried = useRef(false);
  const pendingCount = useMemo(() => pendingPackets(packets).length, [packets]);
  const freshness = useMemo(() => huddleFreshness(huddle), [huddle]);
  const freshnessLine = useMemo(() => freshnessCopy(huddle), [huddle]);

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
        <Body>
          Last hunt: {formatWhen(huddle.updatedAt)}. {freshnessLine} Local simulation until real
          workers.
        </Body>
        {autoNote ? <Body>{autoNote}</Body> : null}
        {freshness === 'aging' || freshness === 'stale' ? (
          <Body>
            {freshness === 'stale'
              ? 'Board may be outdated until you hunt again.'
              : 'Consider a fresh overnight pass before the day gets noisy.'}
          </Body>
        ) : null}
        <Card>
          <Text style={styles.label}>TODAY</Text>
          <Text style={styles.copy}>
            {pendingCount} packet{pendingCount === 1 ? '' : 's'} waiting ·{' '}
            {huddle.questions.length} question{huddle.questions.length === 1 ? '' : 's'} for you
          </Text>
          <View style={styles.actions}>
            {pendingCount > 0 ? (
              <Button label="Review packets" onPress={() => router.push('/(tabs)/packets')} />
            ) : null}
            <Button
              label="Walk one thing"
              variant="ghost"
              onPress={() => router.push('/(tabs)/walk')}
            />
            <Button
              label="Open dialogue"
              variant="ghost"
              onPress={() => router.push('/(tabs)/dialogue')}
            />
          </View>
        </Card>
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
  actions: { gap: space.sm, marginTop: space.sm },
});
