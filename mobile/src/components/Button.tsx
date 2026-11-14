import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/** Quiet, solid chrome button — one accent, no gradients or glows. */
export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const isDisabled = disabled || loading;
  const spinner = variant === 'ghost' || variant === 'secondary' ? colors.primary : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && { backgroundColor: pressed ? colors.primaryDark : colors.primary },
        variant === 'danger' && { backgroundColor: pressed ? colors.dangerDark : colors.danger },
        variant === 'secondary' && [styles.secondary, pressed && { backgroundColor: '#e0e7ff' }],
        variant === 'ghost' && styles.ghost,
        isDisabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={spinner} />
      ) : (
        <Text style={[styles.text, variant === 'ghost' && styles.ghostText, variant === 'secondary' && styles.secondaryText]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondary: { backgroundColor: colors.primarySoft },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  text: { color: '#fff', fontSize: 15, fontWeight: '800', writingDirection: 'rtl' },
  secondaryText: { color: colors.primary },
  ghostText: { color: colors.primary },
});
