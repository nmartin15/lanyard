import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radii, space, type } from '@/lib/theme';

const HERO = require('../../../assets/onboarding/welcome-hero.jpg');

const BEATS = [
  { n: '01', title: 'You', copy: 'Where you sit right now — founder, climber, or operator.' },
  { n: '02', title: 'Ambition', copy: 'What you want next — and what’s off-limits.' },
  { n: '03', title: 'Setup', copy: 'How often they ping you. Then meet your team.' },
];

export default function IntakeWelcome() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.hero}>
        <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.heroVeil} />
        <View style={styles.heroStripe} />
        <View style={[styles.heroCopy, { paddingTop: insets.top + space.md }]}>
          <Text style={styles.brand}>LANYARD</Text>
          <Text style={styles.heroTitle}>You sit.{'\n'}Your team works.</Text>
        </View>
      </View>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <Text style={styles.lead}>
          Five quick questions. Then a small overnight team finds deals, intros, and talent
          while you sleep — no spam, no endless feed.
        </Text>

        <View style={styles.beats}>
          {BEATS.map((beat) => (
            <View key={beat.n} style={styles.beat}>
              <Text style={styles.beatN}>{beat.n}</Text>
              <View style={styles.beatCopy}>
                <Text style={styles.beatTitle}>{beat.title}</Text>
                <Text style={styles.beatBody}>{beat.copy}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => router.push('/intake/archetype')}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.ctaLabel}>Let’s go</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  hero: {
    flex: 1.15,
    justifyContent: 'flex-end',
  },
  heroVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 10, 10, 0.48)',
  },
  heroStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.accent,
  },
  heroCopy: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    gap: space.sm,
  },
  brand: {
    ...type.label,
    color: colors.accent,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.4,
    color: colors.onNight,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -18,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.md,
  },
  lead: {
    ...type.body,
    color: colors.inkMuted,
  },
  beats: { gap: space.sm },
  beat: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  beatN: {
    ...type.label,
    color: colors.ink,
    backgroundColor: colors.paperDeep,
    overflow: 'hidden',
    width: 32,
    textAlign: 'center',
    paddingVertical: 4,
    borderRadius: radii.sm,
    paddingTop: 5,
  },
  beatCopy: { flex: 1, gap: 2 },
  beatTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  beatBody: {
    ...type.caption,
    color: colors.inkMuted,
  },
  cta: {
    marginTop: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    ...type.bodyStrong,
    color: colors.onAccent,
    textAlign: 'center',
  },
});
