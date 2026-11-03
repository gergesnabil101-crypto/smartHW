import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme';

interface Props {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}

/** Row with a right-aligned label (RTL) and a toggle switch. */
export function SwitchRow({ label, value, onChange, hint }: Props) {
  return (
    <Pressable style={styles.row} onPress={() => onChange(!value)}>
      <View style={{ flex: 1 }}>
        <Text style={typography.body}>{label}</Text>
        {hint ? <Text style={typography.caption}>{hint}</Text> : null}
      </View>
      <View style={[styles.sw, value && styles.swOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 12,
  },
  sw: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: colors.border, padding: 2, justifyContent: 'center',
  },
  swOn: { backgroundColor: colors.primary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-start' },
  knobOn: { alignSelf: 'flex-end' },
});
