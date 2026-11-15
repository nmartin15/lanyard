import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/lib/theme';

export default function IntakeLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.paper },
        title: '',
      }}
    />
  );
}
