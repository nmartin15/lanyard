import { Redirect } from 'expo-router';
import React, { useMemo } from 'react';

import { pendingPackets } from '@/lib/packets';
import { homeHref } from '@/lib/resolve';
import { useStore } from '@/lib/store';

export default function Index() {
  const { profile, packets } = useStore();
  const href = useMemo(
    () =>
      homeHref({
        intakeComplete: profile.intakeComplete,
        pendingCount: pendingPackets(packets).length,
      }),
    [profile.intakeComplete, packets]
  );
  return <Redirect href={href} />;
}
