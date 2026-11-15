import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Eyebrow, Field, Title } from '@/components/ui';
import { useStore } from '@/lib/store';
import { colors, space } from '@/lib/theme';

export default function GoalsScreen() {
  const { profile, updateIntake } = useStore();
  const { goals, antiGoals } = profile.intake;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Eyebrow>Step 2</Eyebrow>
        <Title>Goals and anti-goals</Title>
        <Field
          label="This season’s goals"
          placeholder="e.g. one operator hire, two thesis-fit angel checks, warm LP path"
          multiline
          style={{ minHeight: 110, textAlignVertical: 'top' }}
          value={goals}
          onChangeText={(goals) => updateIntake({ goals })}
        />
        <Field
          label="Anti-goals (what we never do)"
          placeholder="e.g. no cold decks to my phone, no random coffee, no posting for reach"
          multiline
          style={{ minHeight: 110, textAlignVertical: 'top' }}
          value={antiGoals}
          onChangeText={(antiGoals) => updateIntake({ antiGoals })}
        />
        <Button
          label="Continue"
          disabled={!goals.trim() || !antiGoals.trim()}
          onPress={() => router.push('/intake/corpus')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
});
