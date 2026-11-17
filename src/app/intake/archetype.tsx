import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeIn } from '@/components/FadeIn';
import { MarkPlate } from '@/components/Marks';
import { IntakeBack } from '@/components/intake/IntakeBack';
import { IntakeProgress } from '@/components/intake/IntakeProgress';
import { PhotoBand } from '@/components/intake/PhotoBand';
import { Button, Choice } from '@/components/ui';
import { intakeBackHref } from '@/lib/intakeFlow';
import { useStore } from '@/lib/store';
import type { Archetype, NetworkAltitude } from '@/lib/types';
import { colors, fonts, space, type } from '@/lib/theme';

const DIRECTION = require('../../../assets/onboarding/step-direction.jpg');

const ARCHETYPES: { id: Archetype; label: string; detail: string }[] = [
  {
    id: 'entrepreneur_investor',
    label: 'Founder + investor',
    detail: 'Running companies and writing checks. Hate noise.',
  },
  {
    id: 'corporate_climber',
    label: 'Climbing inside a company',
    detail: 'Next title, real sponsors, good rooms — not LinkedIn theater.',
  },
  {
    id: 'operator',
    label: 'Operator',
    detail: 'Build the team, land partners, cut busywork.',
  },
  {
    id: 'other',
    label: 'Something else / mix',
    detail: 'We’ll keep it light and swap roles as we learn you.',
  },
];

const ALTITUDES: { id: NetworkAltitude; label: string }[] = [
  { id: 'building', label: 'Building' },
  { id: 'established', label: 'Solid' },
  { id: 'selective', label: 'Selective' },
];

export default function ArchetypeScreen() {
  const { profile, updateIntake } = useStore();
  const { archetype, networkAltitude } = profile.intake;
  const canContinue = !!archetype && !!networkAltitude;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.wrap}>
        <FadeIn>
          <IntakeBack fallback={intakeBackHref('you')} />
        </FadeIn>
        <FadeIn delay={20}>
          <IntakeProgress current="you" />
        </FadeIn>
        <FadeIn delay={40}>
          <PhotoBand
            source={DIRECTION}
            height={112}
            caption="First: where do you sit right now?"
          />
        </FadeIn>
        <FadeIn delay={80}>
          <View style={styles.head}>
            <MarkPlate name="team" />
            <View style={styles.copy}>
              <Text style={styles.title}>What’s your game this year?</Text>
              <Text style={styles.lead}>
                Pick the closest fit. Then how strong your network feels.
              </Text>
            </View>
          </View>
        </FadeIn>
        {ARCHETYPES.map((a, i) => (
          <FadeIn key={a.id} delay={100 + i * 40}>
            <Choice
              label={a.label}
              detail={a.detail}
              selected={archetype === a.id}
              onPress={() => {
                void updateIntake({
                  archetype: a.id,
                  networkAltitude: networkAltitude ?? 'established',
                });
              }}
            />
          </FadeIn>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerLabel}>How strong is your network?</Text>
        <View style={styles.chips}>
          {ALTITUDES.map((a) => {
            const on = networkAltitude === a.id;
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  void updateIntake({ networkAltitude: a.id });
                }}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                accessibilityState={{ selected: on }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  style={[styles.chipText, on && styles.chipTextOn]}
                >
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Button
          label={canContinue ? 'Next: goals' : 'Pick one to keep going'}
          disabled={!canContinue}
          onPress={() => router.push('/intake/goals')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { flex: 1 },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.lg },
  head: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  copy: { flex: 1, gap: space.xs },
  title: { ...type.title, color: colors.ink },
  lead: { ...type.body, color: colors.inkMuted },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
    gap: space.sm,
  },
  footerLabel: { ...type.label, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  chipOn: {
    borderColor: colors.ink,
    backgroundColor: colors.accent,
  },
  chipText: {
    ...type.caption,
    color: colors.ink,
    fontFamily: fonts.bodySemi,
  },
  chipTextOn: { color: colors.ink },
});
