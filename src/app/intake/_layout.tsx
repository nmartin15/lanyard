import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/lib/theme';

/** Own chrome (Back + progress) — hide empty Stack headers. */
export default function IntakeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="archetype" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="corpus" />
      <Stack.Screen name="constraints" />
      <Stack.Screen name="reveal" />
    </Stack>
  );
}
