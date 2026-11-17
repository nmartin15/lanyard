import { Image, type ImageSource } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space, type } from '@/lib/theme';

export function PhotoBand({
  source,
  caption,
  height = 148,
}: {
  source: ImageSource;
  caption?: string;
  height?: number;
}) {
  return (
    <View style={[styles.wrap, { height }]}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={styles.veil} />
      <View style={styles.stripe} />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -space.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.night,
  },
  veil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 10, 10, 0.4)',
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
    paddingHorizontal: space.lg,
    paddingBottom: space.md + 2,
    fontFamily: fonts.bodySemi,
  },
});
