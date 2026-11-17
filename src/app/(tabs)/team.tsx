import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MailConnect } from '@/components/MailConnect';
import { Mark } from '@/components/Marks';
import { ScreenHeader } from '@/components/ScreenHeader';
import { VoicePlayButton } from '@/components/VoicePlayButton';
import { Button, Card, Choice } from '@/components/ui';
import { alternateSeats, assembleTeam } from '@/lib/assembleTeam';
import { formatCorpusLine } from '@/lib/corpus';
import { formatWhen } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { TeamSeat } from '@/lib/types';
import { colors, space, type } from '@/lib/theme';

const PHOTO = require('../../../assets/onboarding/team-bench.jpg');

export default function TeamScreen() {
  const { profile, resetAll, recastSeat, huddle, packets, packetArchive, corpus, updateIntake } =
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
        <ScreenHeader
          eyebrow="Team"
          title="Your overnight team"
          lead="Tap a role to swap it. Your taste file (below) is what they learn from."
          mark="team"
          photo={PHOTO}
          photoCaption="One team. Not five chatbots."
        />
        <Card accent>
          <View style={styles.row}>
            <Mark name="huddle" size={16} />
            <Text style={styles.statusLabel}>Quick look</Text>
          </View>
          <Text style={styles.statusLine}>
            Last overnight {formatWhen(huddle.updatedAt)} · {pendingCount} waiting ·{' '}
            {packetArchive.length} already decided
          </Text>
          <Button
            label="Open Briefing"
            variant="ghost"
            onPress={() => router.navigate('/(tabs)/huddle')}
          />
        </Card>
        <Card>
          <Text style={styles.statusLabel}>How your taste file grows</Text>
          <Text style={styles.statusLine}>
            Intake starts it. Then every Decision, Question answer, Reply, and attachment
            adds a line. Overnight reads that file — so interacting isn’t optional if you want
            better hunts.
          </Text>
          <Text style={styles.statusLine}>
            Briefings stay on this phone. Email is only an optional copy of the long write-up.
          </Text>
        </Card>
        <Card>
          <MailConnect
            intake={profile.intake}
            onChangeProvider={(mailProvider) => {
              void updateIntake({ mailProvider });
            }}
            onChangeEmail={(value) => {
              void updateIntake({ notifyEmail: value });
            }}
          />
        </Card>
        {recentCorpus.length > 0 ? (
          <Card>
            <Text style={styles.statusLabel}>Recent taste notes</Text>
            {recentCorpus.map((item) => (
              <View key={item.id} style={styles.corpusRow}>
                <Text style={styles.statusLine}>· {formatCorpusLine(item)}</Text>
                {item.kind === 'voice' && item.uri ? (
                  <VoicePlayButton uri={item.uri} label="Play" />
                ) : null}
              </View>
            ))}
            <Button
              label="Open Questions"
              variant="ghost"
              onPress={() => router.navigate('/(tabs)/dialogue')}
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
                <Text style={styles.hint}>{open ? 'Pick a swap' : 'Tap to swap'}</Text>
              </Pressable>
              {open ? (
                <View style={styles.recast}>
                  <Choice
                    label="Restore original"
                    selected={false}
                    detail="Put back the role from setup."
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
            Alert.alert(
              'Reset Lanyard?',
              'Clears this phone’s profile and sends you back to setup.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset',
                  style: 'destructive',
                  onPress: () => {
                    void resetAll().then(() => router.replace('/intake'));
                  },
                },
              ]
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statusLabel: { ...type.label, color: colors.ink },
  statusLine: { ...type.caption, color: colors.inkMuted },
  corpusRow: { gap: space.xs },
  seatHit: { gap: space.xs },
  seatTitle: { ...type.bodyStrong, color: colors.ink },
  seatMandate: { ...type.caption, color: colors.inkMuted },
  hint: { ...type.label, color: colors.ink, marginTop: space.xs },
  recast: { gap: space.sm, marginTop: space.sm },
});

