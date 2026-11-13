import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme';
import { Button } from './Button';

export function Loading({ text = 'جاري التحميل...' }: { text?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[typography.bodySecondary, styles.mt]}>{text}</Text>
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.center}>
      <View style={styles.emojiWrap}><Text style={styles.emoji}>📭</Text></View>
      <Text style={[typography.h3, styles.mt]}>{title}</Text>
      {hint ? <Text style={[typography.bodySecondary, styles.mtSm]}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <View style={[styles.emojiWrap, { backgroundColor: colors.dangerSoft }]}><Text style={styles.emoji}>⚠️</Text></View>
      <Text style={[typography.h3, styles.mt]}>حدث خطأ</Text>
      <Text style={[typography.bodySecondary, styles.mtSm]}>{message}</Text>
      {onRetry ? <Button title="إعادة المحاولة" onPress={onRetry} style={styles.retry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emojiWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 34 },
  mt: { marginTop: 12 },
  mtSm: { marginTop: 6 },
  retry: { marginTop: 16, alignSelf: 'stretch' },
});
