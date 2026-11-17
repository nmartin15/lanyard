import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Mark } from '@/components/Marks';
import { colors, fonts, radii, space, type } from '@/lib/theme';

const KEY = 'lanyard.productMap.v6.dismissed';

const ROWS = [
  { n: '1', tab: 'Briefing', mean: 'Read overnight research leads', mark: 'huddle' as const },
  { n: '2', tab: 'Decisions', mean: 'Approve sample outreach to send', mark: 'packets' as const },
  { n: '3', tab: 'Questions', mean: 'Correct the hunt when stuck', mark: 'talk' as const },
];

/** Quiet, dismissible legend — three plain jobs. */
export function ProductMap() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((v) => {
      if (v !== '1') setVisible(true);
    });
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>What you do here</Text>
        <Pressable
          onPress={() => {
            setVisible(false);
            void AsyncStorage.setItem(KEY, '1');
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dismiss how Lanyard works"
        >
          <Text style={styles.dismiss}>Got it</Text>
        </Pressable>
      </View>
      {ROWS.map((row) => (
        <View key={row.tab} style={styles.row}>
          <View style={styles.glyph}>
            <Mark name={row.mark} size={16} color={colors.ink} />
          </View>
          <Text style={styles.n}>{row.n}</Text>
          <Text style={styles.tab}>{row.tab}</Text>
          <Text style={styles.mean}>{row.mean}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radii.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  title: { ...type.label, color: colors.inkFaint },
  dismiss: {
    ...type.caption,
    color: colors.onAccent,
    fontFamily: fonts.bodyBold,
    backgroundColor: colors.accent,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  glyph: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  n: {
    ...type.label,
    color: colors.inkFaint,
    width: 14,
  },
  tab: {
    ...type.bodyStrong,
    color: colors.ink,
    width: 88,
  },
  mean: {
    ...type.caption,
    color: colors.inkMuted,
    flex: 1,
  },
});
