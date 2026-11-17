import { Image, type ImageSource } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MarkPlate, type MarkName } from '@/components/Marks';
import { colors, fonts, space, type } from '@/lib/theme';

/** Title block with optional photo band — atmosphere + one canary edge. */
export function ScreenHeader({
  eyebrow,
  title,
  lead,
  mark,
  photo,
  photoCaption,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  mark: MarkName;
  photo?: ImageSource;
  photoCaption?: string;
}) {
  return (
    <View style={styles.wrap}>
      {photo ? (
        <View style={styles.photo}>
          <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.veil} />
          <View style={styles.stripe} />
          {photoCaption ? <Text style={styles.caption}>{photoCaption}</Text> : null}
        </View>
      ) : null}
      <View style={styles.row}>
        <MarkPlate name={mark} tone={photo ? 'night' : 'soft'} />
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>
      <Text style={styles.lead}>{lead}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  photo: {
    height: 140,
    marginHorizontal: -space.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.night,
  },
  veil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.nightFog,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.accent,
  },
  caption: {
    ...type.caption,
    color: colors.onNight,
    fontFamily: fonts.bodySemi,
    paddingHorizontal: space.lg,
    paddingBottom: space.md + 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  copy: { flex: 1, gap: 4 },
  eyebrow: { ...type.label, color: colors.inkMuted },
  title: { ...type.title, color: colors.ink },
  lead: { ...type.body, color: colors.inkMuted },
});
