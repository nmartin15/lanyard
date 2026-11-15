import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Card, Eyebrow, Title } from '@/components/ui';
import { assembleTeam } from '@/lib/assembleTeam';
import { useStore } from '@/lib/store';
import { colors, space, type } from '@/lib/theme';

export default function RevealScreen() {
  const { profile, completeIntake } = useStore();
  const preview = useMemo(() => assembleTeam(profile.intake), [profile.intake]);

  const onConfirm = async () => {
    await completeIntake();
    router.replace('/(tabs)/team');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Eyebrow>Your team</Eyebrow>
        <Title>Bench cast from your intake</Title>
        <Body>
          One team on your side — not five chatbots to manage. Wrong seat? You can recast
          later.
        </Body>
        {preview.map((seat) => (
          <Card key={seat.role}>
            <Text style={styles.seatTitle}>{seat.title}</Text>
            <Text style={styles.seatMandate}>{seat.mandate}</Text>
          </Card>
        ))}
        <Button label="Confirm team" onPress={onConfirm} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  seatTitle: { ...type.bodyStrong, color: colors.ink },
  seatMandate: { ...type.caption, color: colors.inkMuted },
});
