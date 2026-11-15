import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Choice, Eyebrow, Title } from '@/components/ui';
import { useStore } from '@/lib/store';
import type { Archetype, NetworkAltitude } from '@/lib/types';
import { colors, space } from '@/lib/theme';

const ARCHETYPES: { id: Archetype; label: string; detail: string }[] = [
  {
    id: 'entrepreneur_investor',
    label: 'Entrepreneur & investor',
    detail: 'Operating companies + allocating capital. Noise is the enemy.',
  },
  {
    id: 'corporate_climber',
    label: 'Corporate climber',
    detail: 'Next seat, sponsors, high-signal rooms — not a personal brand feed.',
  },
  {
    id: 'operator',
    label: 'Operator',
    detail: 'Build the bench, partnerships, and what to stop.',
  },
  {
    id: 'other',
    label: 'Other / hybrid',
    detail: 'We’ll start lean and recast as we learn you.',
  },
];

const ALTITUDES: { id: NetworkAltitude; label: string; detail: string }[] = [
  { id: 'building', label: 'Building', detail: 'Still climbing altitude.' },
  { id: 'established', label: 'Established', detail: 'Warm network exists — cut noise.' },
  { id: 'selective', label: 'Selective', detail: 'Access is there; fit over reach.' },
];

export default function ArchetypeScreen() {
  const { profile, updateIntake } = useStore();
  const { archetype, networkAltitude } = profile.intake;
  const canContinue = !!archetype && !!networkAltitude;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Eyebrow>Step 1</Eyebrow>
        <Title>Who are you in this season?</Title>
        {ARCHETYPES.map((a) => (
          <Choice
            key={a.id}
            label={a.label}
            detail={a.detail}
            selected={archetype === a.id}
            onPress={() => updateIntake({ archetype: a.id })}
          />
        ))}
        <Title>Network altitude</Title>
        {ALTITUDES.map((a) => (
          <Choice
            key={a.id}
            label={a.label}
            detail={a.detail}
            selected={networkAltitude === a.id}
            onPress={() => updateIntake({ networkAltitude: a.id })}
          />
        ))}
        <Button
          label="Continue"
          disabled={!canContinue}
          onPress={() => router.push('/intake/goals')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
});
