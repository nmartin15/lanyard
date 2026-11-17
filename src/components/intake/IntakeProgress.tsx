import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  INTAKE_STEPS,
  type IntakeStepId,
  intakeStepIndex,
} from '@/lib/intakeFlow';
import { colors, space, type } from '@/lib/theme';

/** Progress bar — prior steps are tappable so users can jump back. */
export function IntakeProgress({ current }: { current: IntakeStepId }) {
  const index = intakeStepIndex(current);
  const step = INTAKE_STEPS[index];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {INTAKE_STEPS.map((item, i) => {
          const done = i < index;
          const active = i === index;
          const canJump = i < index;
          return (
            <Pressable
              key={item.id}
              disabled={!canJump}
              onPress={() => {
                if (canJump) router.push(item.href);
              }}
              accessibilityRole={canJump ? 'button' : undefined}
              accessibilityLabel={
                canJump
                  ? `Back to ${item.label}`
                  : active
                    ? `${item.label}, current`
                    : `${item.label}, upcoming`
              }
              style={[
                styles.dot,
                done && styles.dotDone,
                active && styles.dotActive,
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.meta}>
        Step {index + 1} of {INTAKE_STEPS.length} · {step.label}
      </Text>
      <Text style={styles.blurb}>{step.blurb}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', gap: 6 },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.paperDeep,
  },
  dotDone: { backgroundColor: colors.ink },
  dotActive: { backgroundColor: colors.accent },
  meta: { ...type.label, color: colors.inkMuted },
  blurb: { ...type.caption, color: colors.inkMuted, marginTop: -2 },
});
