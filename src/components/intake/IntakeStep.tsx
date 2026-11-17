import type { ImageSource } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FadeIn } from '@/components/FadeIn';
import { MarkPlate, type MarkName } from '@/components/Marks';
import { IntakeBack } from '@/components/intake/IntakeBack';
import { IntakeProgress } from '@/components/intake/IntakeProgress';
import { PhotoBand } from '@/components/intake/PhotoBand';
import { intakeBackHref, type IntakeStepId } from '@/lib/intakeFlow';
import { colors, space, type } from '@/lib/theme';

/** Shared intake chrome: back → progress → photo → titled step. */
export function IntakeStep({
  step,
  mark,
  photo,
  photoCaption,
  photoHeight = 120,
  title,
  lead,
  children,
}: {
  step: IntakeStepId;
  mark: MarkName;
  photo: ImageSource;
  photoCaption: string;
  /** Shorter on dense text steps so the keyboard doesn’t bury fields. */
  photoHeight?: number;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <FadeIn>
        <IntakeBack fallback={intakeBackHref(step)} />
      </FadeIn>
      <FadeIn delay={20}>
        <IntakeProgress current={step} />
      </FadeIn>
      <FadeIn delay={40}>
        <PhotoBand source={photo} height={photoHeight} caption={photoCaption} />
      </FadeIn>
      <FadeIn delay={90}>
        <View style={styles.head}>
          <MarkPlate name={mark} />
          <View style={styles.copy}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.lead}>{lead}</Text>
          </View>
        </View>
      </FadeIn>
      <FadeIn delay={140} style={styles.body}>
        {children}
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  copy: { flex: 1, gap: space.xs },
  title: { ...type.title, color: colors.ink },
  lead: { ...type.body, color: colors.inkMuted },
  body: { gap: space.md },
});
