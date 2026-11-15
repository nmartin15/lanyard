import { Redirect } from 'expo-router';
import React from 'react';

import { useStore } from '@/lib/store';

export default function Index() {
  const { profile } = useStore();
  if (profile.intakeComplete) {
    return <Redirect href="/(tabs)/team" />;
  }
  return <Redirect href="/intake" />;
}
