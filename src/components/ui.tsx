import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, radii, space, type } from '@/lib/theme';

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Eyebrow({ children }: { children: string }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'ghost' && styles.btnGhost,
        variant === 'danger' && styles.btnDanger,
        disabled && styles.btnDisabled,
        pressed && !disabled && { opacity: 0.88 },
      ]}
    >
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[
          styles.btnLabel,
          variant === 'primary' && { color: colors.onAccent },
          variant === 'ghost' && { color: colors.ink },
          variant === 'danger' && { color: colors.onNight },
          disabled && styles.btnLabelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Choice({
  label,
  selected,
  onPress,
  detail,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  detail?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ selected }}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <View style={styles.choiceTop} pointerEvents="none">
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.choiceLabel, selected && styles.choiceLabelOn]}
        >
          {label}
        </Text>
        <View style={[styles.radio, selected && styles.radioOn]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      </View>
      {detail ? (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={styles.choiceDetail}
        >
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.fieldLabel} accessibilityElementsHidden>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.inkFaint}
        // Keep body size; cap Dynamic Type so iOS doesn’t blow up focused fields.
        maxFontSizeMultiplier={1.15}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

export function Card({
  children,
  accent,
}: {
  children: React.ReactNode;
  /** Left accent rail — quiet structure for the eye. */
  accent?: boolean;
}) {
  return <View style={[styles.card, accent && styles.cardAccent]}>{children}</View>;
}

export function Rule() {
  return <View style={styles.rule} />;
}

/**
 * One obvious sentence under a title — no box, no shout.
 * Use this instead of dumping jargon alone.
 */
export function Lead({ children }: { children: React.ReactNode }) {
  return <Text style={styles.lead}>{children}</Text>;
}

/** Section row without a full card — list rhythm for skim screens. */
export function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
  },
  eyebrow: {
    ...type.label,
    color: colors.inkMuted,
  },
  title: {
    ...type.title,
    color: colors.ink,
  },
  body: {
    ...type.body,
    color: colors.inkMuted,
  },
  btn: {
    borderRadius: radii.md,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  btnDanger: {
    backgroundColor: colors.danger,
  },
  btnDisabled: {
    backgroundColor: colors.paperDeep,
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnLabel: {
    ...type.bodyStrong,
    color: colors.onAccent,
  },
  btnLabelDisabled: {
    color: colors.inkFaint,
  },
  choice: {
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    padding: space.md,
    gap: 6,
  },
  choiceOn: {
    borderColor: colors.ink,
    backgroundColor: colors.panel,
  },
  choiceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  choiceLabel: {
    ...type.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
  choiceLabelOn: {
    color: colors.ink,
  },
  choiceDetail: {
    ...type.caption,
    color: colors.inkMuted,
    paddingRight: 28,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: colors.ink,
    backgroundColor: colors.accent,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ink,
  },
  fieldLabel: {
    ...type.caption,
    color: colors.inkMuted,
  },
  input: {
    ...type.body,
    // Explicit 16px floor — iOS zooms the page when inputs render below 16.
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
    backgroundColor: colors.panel,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    gap: space.sm,
  },
  cardAccent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderColor: colors.ink,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginVertical: space.xs,
  },
  lead: {
    ...type.body,
    color: colors.inkMuted,
    marginTop: -4,
  },
  section: {
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  sectionLabel: {
    ...type.label,
    color: colors.inkFaint,
  },
  sectionBody: {
    gap: 6,
  },
});
