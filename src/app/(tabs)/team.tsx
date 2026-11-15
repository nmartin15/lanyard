import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VoicePlayButton } from '@/components/VoicePlayButton';
import { Body, Button, Card, Choice, Eyebrow, Title } from '@/components/ui';
import { alternateSeats, assembleTeam } from '@/lib/assembleTeam';
import { formatCorpusLine } from '@/lib/corpus';
import { formatWhen } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { TeamSeat } from '@/lib/types';
import { colors, space, type } from '@/lib/theme';

export default function TeamScreen() {
  const { profile, resetAll, recastSeat, huddle, packets, packetArchive, corpus } =
    useStore();
  const [recastingIndex, setRecastingIndex] = useState<number | null>(null);

  const options = useMemo(() => {
    if (recastingIndex === null) return [] as TeamSeat[];
    return alternateSeats(profile.team);
  }, [profile.team, recastingIndex]);

  const pendingCount = useMemo(
    () => packets.filter((p) => p.status === 'pending').length,
    [packets]
  );

  const recentCorpus = useMemo(
    () => [...corpus].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3),
    [corpus]
  );

  const restoreFromIntake = async (index: number) => {
    const fresh = assembleTeam(profile.intake);
    const seat = fresh[index];
    if (!seat) return;
    await recastSeat(index, seat);
    setRecastingIndex(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Eyebrow>Lanyard</Eyebrow>
        <Title>Your team</Title>
        <Body>Working on your behalf. Tap a seat to recast.</Body>
        <Card>
          <Text style={styles.statusLabel}>BOARD</Text>
          <Text style={styles.statusLine}>
            Last hunt {formatWhen(huddle.updatedAt)} · {pendingCount} pending ·{' '}
            {packetArchive.length} archived
          </Text>
          <Button label="Open huddle" variant="ghost" onPress={() => router.push('/(tabs)/huddle')} />
        </Card>
        {recentCorpus.length > 0 ? (
          <Card>
            <Text style={styles.statusLabel}>RECENT CORPUS</Text>
            {recentCorpus.map((item) => (
              <View key={item.id} style={styles.corpusRow}>
                <Text style={styles.statusLine}>· {formatCorpusLine(item)}</Text>
                {item.kind === 'voice' && item.uri ? (
                  <VoicePlayButton uri={item.uri} label="Play" />
                ) : null}
              </View>
            ))}
            <Button
              label="Open dialogue"
              variant="ghost"
              onPress={() => router.push('/(tabs)/dialogue')}
            />
          </Card>
        ) : null}
        {profile.team.map((seat, index) => {
          const open = recastingIndex === index;
          return (
            <Card key={`${seat.role}-${seat.title}-${index}`}>
              <Pressable
                onPress={() => setRecastingIndex(open ? null : index)}
                accessibilityRole="button"
                accessibilityLabel={`Recast ${seat.title}`}
                style={styles.seatHit}
              >
                <Text style={styles.seatTitle}>{seat.title}</Text>
                <Text style={styles.seatMandate}>{seat.mandate}</Text>
                <Text style={styles.hint}>{open ? 'Choose a replacement' : 'Tap to recast'}</Text>
              </Pressable>
              {open ? (
                <View style={styles.recast}>
                  <Choice
                    label="Restore from intake"
                    selected={false}
                    detail="Put back the seat this bench was cast with."
                    onPress={() => {
                      void restoreFromIntake(index);
                    }}
                  />
                  {options.map((opt) => (
                    <Choice
                      key={`${opt.role}-${opt.title}`}
                      label={opt.title}
                      selected={false}
                      detail={opt.mandate}
                      onPress={() => {
                        void recastSeat(index, opt).then(() => setRecastingIndex(null));
                      }}
                    />
                  ))}
                  <Button label="Cancel" variant="ghost" onPress={() => setRecastingIndex(null)} />
                </View>
              ) : null}
            </Card>
          );
        })}
        <Button
          label="Reset intake"
          variant="ghost"
          onPress={() =>
            Alert.alert('Reset Lanyard?', 'Clears local profile and returns to intake.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Reset',
                style: 'destructive',
                onPress: () => {
                  void resetAll().then(() => router.replace('/intake'));
                },
              },
            ])
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  statusLabel: { ...type.label, color: colors.accent },
  statusLine: { ...type.caption, color: colors.inkMuted },
  corpusRow: { gap: space.xs },
  seatHit: { gap: space.xs },
  seatTitle: { ...type.bodyStrong, color: colors.ink },
  seatMandate: { ...type.caption, color: colors.inkMuted },
  hint: { ...type.label, color: colors.accent, marginTop: space.xs },
  recast: { gap: space.sm, marginTop: space.sm },
});
