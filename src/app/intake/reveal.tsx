import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mark } from '@/components/Marks';
import { IntakeBack } from '@/components/intake/IntakeBack';
import { IntakeProgress } from '@/components/intake/IntakeProgress';
import { PhotoBand } from '@/components/intake/PhotoBand';
import { Body, Button, Card } from '@/components/ui';
import { assembleTeam } from '@/lib/assembleTeam';
import { intakeBackHref } from '@/lib/intakeFlow';
import { useStore } from '@/lib/store';
import { colors, fonts, space, type } from '@/lib/theme';

const BENCH = require('../../../assets/onboarding/team-bench.jpg');

function shortMandate(text: string, max = 88): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export default function RevealScreen() {
  const { profile, completeIntake } = useStore();
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => assembleTeam(profile.intake), [profile.intake]);

  const onConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await completeIntake();
      router.replace('/(tabs)/huddle');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.wrap}>
        <IntakeBack fallback={intakeBackHref('team')} />
        <IntakeProgress current="team" />
        <PhotoBand
          source={BENCH}
          height={112}
          caption="Real roles. Not five chatbots."
        />
        <Text style={styles.title}>Here’s your overnight team</Text>
        <Text style={styles.lead}>
          They research while you sleep. In the morning: skim leads, approve sample outreach,
          send from your work email.
        </Text>

        <Card accent>
          <Text style={styles.howLabel}>How you use it</Text>
          <Text style={styles.howLine}>1. Briefing — read overnight research</Text>
          <Text style={styles.howLine}>2. Decisions — approve sample outreach</Text>
          <Text style={styles.howLine}>3. Questions — correct the hunt when stuck</Text>
          <Body>
            Connect Gmail so approved notes can send. Briefings stay on your phone; email is
            optional. After setup, talking back (Decisions / Questions / Reply) builds the
            corpus that makes overnight smarter.
          </Body>
        </Card>

        <Text style={styles.seatsLabel}>Your team</Text>
        {preview.map((seat, index) => (
          <View key={`${seat.role}-${seat.title}`} style={styles.seat}>
            <Mark name="bench" size={16} />
            <View style={styles.seatCopy}>
              <Text style={styles.seatTitle}>
                {String(index + 1).padStart(2, '0')} · {seat.title}
              </Text>
              <Text style={styles.seatMandate}>{shortMandate(seat.mandate)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={busy ? 'Opening…' : 'See what’s waiting'}
          disabled={busy}
          onPress={() => {
            void onConfirm();
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { flex: 1 },
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.lg },
  title: { ...type.title, color: colors.ink },
  lead: { ...type.body, color: colors.inkMuted },
  howLabel: { ...type.label, color: colors.ink },
  howLine: { ...type.bodyStrong, color: colors.ink },
  seatsLabel: { ...type.label, color: colors.inkFaint, marginTop: space.xs },
  seat: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  seatCopy: { flex: 1, gap: 2 },
  seatTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    color: colors.ink,
  },
  seatMandate: { ...type.caption, color: colors.inkMuted },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
});
