import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/lib/theme';

export type MarkName =
  | 'team'
  | 'huddle'
  | 'walk'
  | 'packets'
  | 'talk'
  | 'yes'
  | 'no'
  | 'reshape'
  | 'bench'
  | 'ask'
  | 'filter'
  | 'chase'
  | 'thesis'
  | 'next';

const ICONS: Record<MarkName, keyof typeof Ionicons.glyphMap> = {
  team: 'people-outline',
  huddle: 'sunny-outline',
  walk: 'walk-outline',
  packets: 'documents-outline',
  talk: 'chatbubbles-outline',
  yes: 'checkmark-circle',
  no: 'close-circle',
  reshape: 'create-outline',
  bench: 'briefcase-outline',
  ask: 'help-circle-outline',
  filter: 'shield-checkmark-outline',
  chase: 'locate-outline',
  thesis: 'bulb-outline',
  next: 'arrow-forward-circle-outline',
};

export function Mark({
  name,
  size = 18,
  color = colors.ink,
}: {
  name: MarkName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={ICONS[name]} size={size} color={color} />;
}

/** Glyph plate — quiet by default; yellow only when tone asks for it. */
export function MarkPlate({
  name,
  tone = 'soft',
}: {
  name: MarkName;
  tone?: 'soft' | 'night' | 'accent' | 'danger';
}) {
  const night = tone === 'night';
  const accent = tone === 'accent';
  const danger = tone === 'danger';
  return (
    <View
      style={[
        styles.plate,
        night && styles.plateNight,
        accent && styles.plateAccent,
        danger && styles.plateDanger,
      ]}
    >
      <Mark
        name={name}
        size={20}
        color={night || danger ? colors.onNight : colors.ink}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperDeep,
  },
  plateNight: {
    backgroundColor: colors.night,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  plateAccent: {
    backgroundColor: colors.accent,
  },
  plateDanger: { backgroundColor: colors.danger },
});
