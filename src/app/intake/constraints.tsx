import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Choice, Eyebrow, Title } from '@/components/ui';
import { useStore } from '@/lib/store';
import { colors, space } from '@/lib/theme';

export default function ConstraintsScreen() {
  const { profile, updateIntake } = useStore();
  const { interruptPolicy, neverMessageAsMe } = profile.intake;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Eyebrow>Step 4</Eyebrow>
        <Title>How the team may interrupt you</Title>
        <Choice
          label="Rare interrupts"
          detail="Huddle when you open. Tap only if truly time-sensitive."
          selected={interruptPolicy === 'rare'}
          onPress={() => {
            void updateIntake({ interruptPolicy: 'rare' });
          }}
        />
        <Choice
          label="Normal"
          detail="A bit more proactive when something clears the bar."
          selected={interruptPolicy === 'normal'}
          onPress={() => {
            void updateIntake({ interruptPolicy: 'normal' });
          }}
        />
        <Title>Reputation</Title>
        <Choice
          label="Never message as me without asking"
          detail="Default. You own every external first touch."
          selected={neverMessageAsMe}
          onPress={() => {
            void updateIntake({ neverMessageAsMe: true });
          }}
        />
        <Choice
          label="I may allow send-as-me later"
          detail="Still requires explicit enablement per class of move."
          selected={!neverMessageAsMe}
          onPress={() => {
            void updateIntake({ neverMessageAsMe: false });
          }}
        />
        <Body>Next: we cast your bench from this intake.</Body>
        <Button label="Assemble my team" onPress={() => router.push('/intake/reveal')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
});
