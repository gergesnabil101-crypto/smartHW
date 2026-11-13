import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius, typography } from '../theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

/** RTL-aware labelled text input. */
export function Input({ label, error, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? <Text style={typography.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, focused && styles.inputFocused, error && styles.inputError, style]}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, gap: 6 },
  input: {
    backgroundColor: colors.surfaceTint,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 50,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, textAlign: 'right', writingDirection: 'rtl' },
});
