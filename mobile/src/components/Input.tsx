import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius, typography } from '../theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

/** RTL-aware labelled text input. Password fields get an eye toggle automatically. */
export function Input({ label, error, style, onFocus, onBlur, secureTextEntry, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? <Text style={typography.label}>{label}</Text> : null}
      <View>
        <TextInput
          style={[styles.input, secureTextEntry && styles.inputWithEye, focused && styles.inputFocused, error && styles.inputError, style]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry && !showSecret}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setShowSecret((s) => !s)} style={styles.eye} hitSlop={8}>
            <Text style={styles.eyeText}>{showSecret ? '🙈' : '👁️'}</Text>
          </Pressable>
        ) : null}
      </View>
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
  inputWithEye: { paddingLeft: 44 },
  eye: { position: 'absolute', left: 6, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 8 },
  eyeText: { fontSize: 16 },
  error: { color: colors.danger, fontSize: 12, textAlign: 'right', writingDirection: 'rtl' },
});
