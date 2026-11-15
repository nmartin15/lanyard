import { router } from 'expo-router';
import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Eyebrow } from '@/components/ui';
import { colors, space, type } from '@/lib/theme';

export default function IntakeWelcome() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Eyebrow>Lanyard</Eyebrow>
        <Text style={styles.hero}>You sit. Your team works.</Text>
        <Body>
          Intake builds your case. From that, we cast a bench that advocates for you —
          career, business, capital, whatever you need — without spam or noise.
        </Body>
        <Body>Different lives get different teams. This is not a feed.</Body>
        <Button label="Begin intake" onPress={() => router.push('/intake/archetype')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: {
    padding: space.lg,
    gap: space.md,
    paddingBottom: space.xxl,
  },
  hero: {
    ...type.hero,
    color: colors.ink,
  },
});
