import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radii, space, type } from '@/lib/theme';

/** Explicit back — never rely on a missing Stack chevron. */
export function IntakeBack({
  fallback,
  label = 'Back',
}: {
  fallback: Href;
  label?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace(fallback);
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.hit, pressed && { opacity: 0.75 }]}
    >
      <Ionicons name="chevron-back" size={22} color={colors.ink} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginLeft: -space.xs,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    backgroundColor: colors.panel,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  label: {
    ...type.caption,
    fontFamily: fonts.bodySemi,
    color: colors.ink,
    paddingRight: 4,
  },
});
