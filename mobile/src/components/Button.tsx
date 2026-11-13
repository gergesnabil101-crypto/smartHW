import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadows } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const GRADIENTS: Record<string, readonly [string, string]> = {
  primary: [colors.primary, colors.primaryDark],
  danger: ['#ef4444', colors.dangerDark],
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const isDisabled = disabled || loading;
  const gradient = GRADIENTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
    >
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.gradient, variant === 'primary' && shadows.elev, variant === 'danger' && shadows.elevDanger]}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' || variant === 'secondary' ? colors.primary : '#fff'} />
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
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    overflow: 'hidden',
  },
  gradient: { borderRadius: radius.lg },
  secondary: { backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: '#c7d2fe' },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  text: { color: '#fff', fontSize: 16, fontWeight: '800', writingDirection: 'rtl', zIndex: 1 },
  secondaryText: { color: colors.primary },
  ghostText: { color: colors.primary },
});
